import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { once } from 'node:events';
import { Pool } from 'pg';
import { loadConfig } from '../config/env.js';
import { createPrisma } from '../lib/prisma.js';
import { createApp } from '../app.js';
import { contracts } from '../schemas/contracts.js';
import { directory } from '../services/provision.js';

async function main() {
  const config = loadConfig();
  assert(config.MIGRATION_DATABASE_URL, 'Separate migration credentials are required');
  const db = createPrisma(config);
  const txOptions = { maxWait: config.DB_TIMEOUT_MS, timeout: 15000 };
  const ownerUrl = new URL(config.MIGRATION_DATABASE_URL);
  // Match Prisma/libpq's require semantics in pg when verification was explicitly skipped.
  if (ownerUrl.searchParams.get('sslmode') === 'require' && !ownerUrl.searchParams.has('uselibpqcompat')) ownerUrl.searchParams.set('uselibpqcompat', 'true');
  const owner = new Pool({ connectionString: ownerUrl.toString(), max: 1, connectionTimeoutMillis: config.DB_TIMEOUT_MS, query_timeout: config.DB_TIMEOUT_MS });
  const appPool = new Pool({ connectionString: config.DATABASE_URL, max: 1, connectionTimeoutMillis: config.DB_TIMEOUT_MS, query_timeout: config.DB_TIMEOUT_MS });
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
  let stage = 'configuration';
  try {
    stage = 'database identity and TLS';
    const [identity] = await db.$queryRaw<Array<{ name: string; rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean; rolcreaterole: boolean }>>`
      SELECT current_user AS name, r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole
      FROM pg_roles r WHERE r.rolname = current_user`;
    assert(identity && !identity.rolsuper && !identity.rolbypassrls && !identity.rolcreatedb && !identity.rolcreaterole);
    const tlsClient = await appPool.connect();
    try {
      // pg_stat_ssl describes the pooler-to-Postgres hop. Inspect our TLS socket
      // to verify the application-to-pooler connection instead.
      const connection = tlsClient as unknown as { connection: { stream: { encrypted?: boolean } } };
      if (new URL(config.DATABASE_URL).hostname !== 'localhost') assert(connection.connection.stream.encrypted, 'TLS required for remote database');
    } finally { tlsClient.release(); }
    const ownerIdentity = await owner.query('SELECT current_user AS name');
    assert.notEqual(identity.name, ownerIdentity.rows[0].name);
    console.log('PASS: separate restricted application identity and encrypted connection');

    stage = 'committed migrations';
    const applied = await owner.query('SELECT migration_name FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    for (const migration of readdirSync('prisma/migrations', { withFileTypes: true }).filter(entry => entry.isDirectory())) {
      assert(applied.rows.some(row => row.migration_name === migration.name), `Migration pending: ${migration.name}`);
    }
    console.log('PASS: all committed migrations applied');

    stage = 'table permissions and browser denial';
    const tables = await owner.query(`SELECT c.relname, c.relrowsecurity,
      pg_get_userbyid(c.relowner) = $1 AS app_owns_table,
      has_table_privilege($1, c.oid, 'SELECT') AND has_table_privilege($1, c.oid, 'INSERT')
        AND has_table_privilege($1, c.oid, 'UPDATE') AND has_table_privilege($1, c.oid, 'DELETE') AS app_access,
      EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
        AND has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS browser_access
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> '_prisma_migrations'`, [identity.name]);
    assert.equal(tables.rows.length, 20, 'Expected all 20 application tables');
    for (const table of tables.rows) {
      assert(table.relrowsecurity && table.app_access && !table.app_owns_table && !table.browser_access, `Unsafe permissions: ${table.relname}`);
    }
    const schema = await owner.query("SELECT has_schema_privilege($1, 'public', 'CREATE') AS can_create", [identity.name]);
    assert.equal(schema.rows[0].can_create, false);
    console.log('PASS: RLS and restricted grants on 20 tables; browser roles denied; app cannot create schema objects');

    stage = 'prepared statements';
    const client = await appPool.connect();
    try {
      for (const value of [1, 2]) {
        const result = await client.query({ name: 'spoonate_connection_check', text: 'SELECT $1::integer AS value', values: [value] });
        assert.equal(result.rows[0].value, value);
      }
      stage = 'bounded application pool exhaustion';
      await assert.rejects(appPool.connect());
    } finally { client.release(); }
    console.log('PASS: repeated named prepared statement');
    await appPool.query('SELECT 1');
    console.log('PASS: exhausted one-connection application pool times out and recovers after release');

    stage = 'interactive transactions';
    await db.$transaction(async tx => { await tx.$queryRaw`SELECT 1`; await tx.canteen.count(); }, txOptions);
    const probeId = randomUUID();
    const rollback = new Error('intentional rollback');
    await assert.rejects(db.$transaction(async tx => {
      await tx.auditLog.create({ data: { id: probeId, action: 'CONNECTION_CHECK', target: probeId, requestId: randomUUID() } });
      await tx.auditLog.update({ where: { id: probeId }, data: { target: 'rollback-check' } });
      assert.equal(await tx.auditLog.count({ where: { id: probeId } }), 1);
      await tx.auditLog.delete({ where: { id: probeId } });
      await tx.auditLog.create({ data: { id: probeId, action: 'CONNECTION_CHECK', target: probeId, requestId: randomUUID() } });
      throw rollback;
    }, txOptions), error => error === rollback);
    assert.equal(await db.auditLog.count({ where: { id: probeId } }), 0);
    console.log('PASS: interactive commit and CRUD rollback; no probe records retained');

    stage = 'seeded directory';
    const rows = await db.canteen.findMany({ select: { slug: true } });
    for (const [slug] of directory) assert(rows.some(row => row.slug === slug), `Missing canteen: ${slug}`);
    console.log('PASS: all eight canteens present');

    stage = 'Express readiness and directory';
    server = createApp({ ...config, LOG_LEVEL: 'silent' }, db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    for (const path of ['/health/live', '/health/ready', '/api/v1/canteens', '/api/v1/catalog']) {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(config.DB_TIMEOUT_MS + 2000) });
      assert.equal(response.status, 200, path);
      const body = await response.json();
      if (path === '/api/v1/canteens') contracts['GET /canteens']!.response.parse(body);
      else if (path === '/api/v1/catalog') contracts['GET /catalog']!.response.parse(body);
      else assert.equal(body.ok, true);
    }
    console.log('PASS: Express liveness, database readiness and directory/catalog response contracts');
    const admins = await db.userRole.count({ where: { role: 'ADMIN' } });
    const codes = await db.canteenAccessCode.count({ where: { active: true } });
    console.log(`Provisioning inventory: ${admins} admin account(s), ${codes} active canteen code(s).`);
  } catch (error) {
    // Driver errors can include connection details; only report the failing check.
    console.error(`Database qualification failed at: ${stage}.`);
    if (error instanceof assert.AssertionError) console.error(error.message);
    else if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(error.code)) console.error(`Error code: ${error.code}`);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await Promise.allSettled([db.$disconnect(), owner.end(), appPool.end()]);
  }
}
void main().catch(() => { console.error('Database check failed: invalid configuration or credentials.'); process.exitCode = 1; });
