import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed } from '../../src/services/provision.js';
import { createOutboxWorker } from '../../src/services/outbox.js';
import { contracts } from '../../src/schemas/contracts.js';
import type { Role, OrderStatus } from '../../src/generated/prisma/client.js';
const url = process.env.NOTIFICATION_TEST_DATABASE_URL;
test('durable notifications, leased worker recovery, scoped pagination and read actions', { skip: !url }, async t => {
  assert(url); const address = new URL(url);
  assert(['localhost', '127.0.0.1'].includes(address.hostname) && address.pathname.includes('test'));
  assert.notEqual(url, process.env.DATABASE_URL);
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url }, encoding: 'utf8', timeout: 180000 });
  assert.equal(migration.status, 0, migration.stderr);
  const config = loadConfig({ DATABASE_URL: url, APP_ENV: 'test', NODE_ENV: 'test', FRONTEND_ORIGIN: 'http://localhost:5173',
    SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SEED_DEVELOPMENT_DATA: 'true', LOG_LEVEL: 'silent', DB_TIMEOUT_MS: '10000' });
  const db = createPrisma(config); await seed(db, config);
  const canteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'bella-bite' } });
  const server = createApp(config, db, () => {}).listen(0, '127.0.0.1');
  await once(server, 'listening'); const port = server.address(); assert(port && typeof port !== 'string');
  const base = `http://127.0.0.1:${port.port}/api/v1`;
  class Browser {
    jar = new Map<string, string>(); csrf = '';
    async request(path: string, method = 'GET', body?: object, key?: string) {
      const response = await fetch(base + path, { method, headers: { Origin: config.FRONTEND_ORIGIN,
        Cookie: [...this.jar].map(([name, value]) => `${name}=${value}`).join('; '),
        ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0]!.split('='); this.jar.set(name!, value!); }
      return { status: response.status, body: await response.json() };
    }
    async prepare() { this.csrf = (await this.request('/auth/csrf')).body.csrfToken; return this; }
  }
  async function fixture(role: Role, email: string, canteenId?: string) {
    const user = await db.user.create({ data: { email, name: 'Notification Test', supabaseSubject: randomUUID(), emailVerifiedAt: new Date(), roles: { create: { role } } } });
    const membership = canteenId ? await db.canteenMembership.create({ data: { userId: user.id, canteenId, codeVersion: 1 } }) : null;
    const token = randomBytes(32).toString('hex');
    const session = await db.session.create({ data: { userId: user.id, role, canteenId, membershipId: membership?.id,
      tokenHash: createHmac('sha256', config.SESSION_SECRET).update(`session:${token}`).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    const browser = await new Browser().prepare(); browser.jar.set('spoonate_session', token);
    return { user, session, browser };
  }
  const student = await fixture('STUDENT', 'notifications@banasthali.in');
  const other = await fixture('STUDENT', 'other-notifications@banasthali.in');
  const staff = await fixture('CANTEEN', 'notifications-staff@example.edu', canteen.id);
  const worker = createOutboxWorker(db, config);
  let fixtureCode = 0;
  async function job(status: OrderStatus = 'READY', recipientId = student.user.id) {
    const order = await db.order.create({ data: { studentId: recipientId, canteenId: canteen.id, status,
      totalPaise: 1000, pickupAt: new Date(), codeDay: new Date('2026-10-15'), orderCode: (++fixtureCode).toString(36).toUpperCase().padStart(3, '0') } });
    const event = await db.orderEvent.create({ data: { orderId: order.id, actorId: staff.user.id, newStatus: status } });
    const outbox = await db.outboxEvent.create({ data: { eventId: event.id, payload: { type: 'ORDER_STATUS_CHANGED' } } });
    return { order, event, outbox };
  }
  try {
    await t.test('acceptance and ready transitions commit before worker delivery and offline clients recover both messages', async () => {
      const item = await db.menuItem.findFirstOrThrow({ where: { canteenId: canteen.id } });
      const cart = (await student.browser.request('/cart')).body;
      const filled = (await student.browser.request('/cart/items', 'POST', { expectedVersion: cart.version, menuItemId: item.id, quantity: 1 })).body;
      const placed = await student.browser.request('/orders', 'POST', { expectedVersion: filled.version, quote: filled.quote, pickupAt: new Date(Date.now() + 1200000).toISOString() }, randomUUID());
      assert.equal(placed.status, 201);
      const order = placed.body;
      for (const [action, version] of [['accept', 1], ['prepare', 2], ['ready', 3]] as const) {
        assert.equal((await staff.browser.request(`/orders/${order.id}/${action}`, 'POST', { expectedVersion: version }, randomUUID())).status, 200);
      }
      assert.equal(await db.notification.count(), 0);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'READY');
      assert.equal(await worker.runBatch(), 4);
      assert.equal(await db.notification.count({ where: { recipientId: student.user.id } }), 2);
      const reconnect = await new Browser().prepare(); reconnect.jar.set('spoonate_session', student.browser.jar.get('spoonate_session')!);
      const page = await reconnect.request('/notifications'); assert.equal(page.status, 200);
      contracts['GET /notifications']!.response.parse(page.body);
      assert.deepEqual(page.body.items.map((row: { type: string }) => row.type).sort(), ['ACCEPTED', 'READY']);
      assert.equal(page.body.unreadCount, 2);
    });
    await t.test('two workers claim a row once and fencing prevents an expired worker from delivering it', async () => {
      const created = await job();
      const workers = [createOutboxWorker(db, config), createOutboxWorker(db, config)];
      const claims = await Promise.all(workers.map(value => value.claim()));
      assert.equal(claims.filter(Boolean).length, 1);
      const old = claims.find(Boolean)!;
      await db.outboxEvent.update({ where: { id: created.outbox.id }, data: { leaseUntil: new Date(0) } });
      const reclaimed = await worker.claim(); assert(reclaimed); assert.notEqual(reclaimed.leaseOwner, old.leaseOwner);
      assert.equal(await worker.deliver(old), false);
      await worker.fail(old, new Error('stale failure'));
      assert.equal((await db.outboxEvent.findUniqueOrThrow({ where: { id: created.outbox.id } })).leaseOwner, reclaimed.leaseOwner);
      assert.equal(await worker.deliver(reclaimed), true);
    });
    await t.test('a worker killed after its durable claim is recovered by a restarted worker', async () => {
      const created = await job();
      const code = `const { loadConfig } = require('./src/config/env.ts'); const { createPrisma } = require('./src/lib/prisma.ts'); const { createOutboxWorker } = require('./src/services/outbox.ts'); (async () => { const c=loadConfig(); const db=createPrisma(c); const worker=createOutboxWorker(db,c); console.log(JSON.stringify(await worker.claim())); setInterval(()=>{},1000); })().catch(error => { console.error(error); process.exit(1); });`;
      const child = spawn(process.execPath, ['--import', 'tsx', '-e', code], { env: { ...process.env,
        DATABASE_URL: url, APP_ENV: 'test', NODE_ENV: 'test', FRONTEND_ORIGIN: config.FRONTEND_ORIGIN,
        SESSION_SECRET: config.SESSION_SECRET, OTP_SECRET: config.OTP_SECRET }, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = ''; let errors = '';
      child.stderr.on('data', data => { errors += String(data); });
      const claimed = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Crash fixture did not claim: ' + errors)), 30000);
        child.stdout.on('data', data => { output += String(data); if (output.includes('\n')) { clearTimeout(timeout); resolve(output.trim()); } });
        child.on('error', reject); child.on('exit', status => { if (!output) { clearTimeout(timeout); reject(new Error(`Crash fixture exited ${status}: ${errors}`)); } });
      }).finally(() => { child.kill('SIGKILL'); });
      if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');
      assert.equal(JSON.parse(claimed).id, created.outbox.id);
      assert.equal(await db.notification.count({ where: { sourceEventId: created.event.id } }), 0);
      await db.outboxEvent.update({ where: { id: created.outbox.id }, data: { leaseUntil: new Date(0) } });
      const restarted = createOutboxWorker(db, config); await restarted.runBatch();
      assert.equal(await db.notification.count({ where: { sourceEventId: created.event.id } }), 1);
    });
    await t.test('duplicate deliveries create one notification, including reprocessing a completed job', async () => {
      const created = await job('ACCEPTED');
      await db.outboxEvent.create({ data: { eventId: created.event.id, payload: {} } });
      await worker.runBatch();
      await db.outboxEvent.update({ where: { id: created.outbox.id }, data: { state: 'PENDING' } });
      await worker.runBatch();
      assert.equal(await db.notification.count({ where: { sourceEventId: created.event.id } }), 1);
    });
    await t.test('delivery failure rolls back notification insertion, retries with backoff and supports operator retry', async () => {
      const created = await job();
      await db.$executeRawUnsafe("CREATE FUNCTION phase9_delivery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private upstream error'; END $$");
      await db.$executeRawUnsafe('CREATE TRIGGER phase9_delivery_failure AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION phase9_delivery_failure()');
      try {
        const bounded = createOutboxWorker(db, { ...config, OUTBOX_BATCH_SIZE: 1, OUTBOX_MAX_ATTEMPTS: 2 });
        await bounded.runBatch();
        const retry = await db.outboxEvent.findUniqueOrThrow({ where: { id: created.outbox.id } });
        assert.equal(retry.state, 'PENDING'); assert.equal(retry.attempts, 1); assert(retry.availableAt > new Date());
        assert(!retry.lastError?.includes('private')); assert.equal(await db.notification.count({ where: { sourceEventId: created.event.id } }), 0);
        assert.equal((await db.order.findUniqueOrThrow({ where: { id: created.order.id } })).status, 'READY');
        assert.equal(await bounded.runBatch(), 0);
        await db.outboxEvent.update({ where: { id: retry.id }, data: { availableAt: new Date(0) } });
        await bounded.runBatch();
        assert.equal((await db.outboxEvent.findUniqueOrThrow({ where: { id: retry.id } })).state, 'FAILED');
        assert.equal(await bounded.runBatch(), 0);
      } finally {
        await db.$executeRawUnsafe('DROP TRIGGER phase9_delivery_failure ON notifications');
        await db.$executeRawUnsafe('DROP FUNCTION phase9_delivery_failure()');
      }
      const reset = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/outbox-retry.ts', created.outbox.id], { env: { ...process.env,
        DATABASE_URL: url, APP_ENV: 'test', NODE_ENV: 'test', FRONTEND_ORIGIN: config.FRONTEND_ORIGIN,
        SESSION_SECRET: config.SESSION_SECRET, OTP_SECRET: config.OTP_SECRET }, encoding: 'utf8', timeout: 30000 });
      assert.equal(reset.status, 0, reset.stderr);
      await worker.runBatch();
      assert.equal(await db.notification.count({ where: { sourceEventId: created.event.id } }), 1);
      assert.equal((await db.outboxEvent.findUniqueOrThrow({ where: { id: created.outbox.id } })).state, 'COMPLETED');
    });
    await t.test('the real worker process delivers using an application role with RLS and shuts down cleanly', async () => {
      const role = 'phase9_worker_' + randomBytes(6).toString('hex');
      await db.$executeRawUnsafe(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS`);
      const grants = spawnSync('psql', ['-h', address.hostname, '-p', address.port || '5432', '-U', decodeURIComponent(address.username),
        '-d', address.pathname.slice(1), '-v', `app_role=${role}`, '-f', 'prisma/application-role.sql'], {
        env: { ...process.env, PGPASSWORD: decodeURIComponent(address.password) }, encoding: 'utf8', timeout: 30000 });
      assert.equal(grants.status, 0, grants.stderr);
      const appUrl = new URL(url); appUrl.username = role; appUrl.password = '';
      const created = await job();
      const child = spawn(process.execPath, ['--import', 'tsx', 'src/outbox-worker.ts'], { env: { ...process.env,
        DATABASE_URL: appUrl.toString(), APP_ENV: 'test', NODE_ENV: 'test', FRONTEND_ORIGIN: config.FRONTEND_ORIGIN,
        SESSION_SECRET: config.SESSION_SECRET, OTP_SECRET: config.OTP_SECRET, OUTBOX_POLL_MS: '100', LOG_LEVEL: 'info' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let errors = ''; child.stderr.on('data', data => { errors += String(data); });
      try {
        const deadline = Date.now() + 30000;
        while ((await db.outboxEvent.findUniqueOrThrow({ where: { id: created.outbox.id } })).state !== 'COMPLETED') {
          assert(Date.now() < deadline, 'Worker did not deliver: ' + errors);
          assert.equal(child.exitCode, null, errors);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.equal(await db.notification.count({ where: { sourceEventId: created.event.id } }), 1);
      } finally {
        const exited = once(child, 'exit'); child.kill('SIGTERM');
        const timeout = setTimeout(() => child.kill('SIGKILL'), 25000);
        const [code, signal] = await exited; clearTimeout(timeout);
        assert.equal(code, 0, errors); assert.equal(signal, null);
      }
    });
    await t.test('pagination, unread totals and read actions are scoped, stable and idempotent across devices', async () => {
      const theirs = await job('READY', other.user.id); await worker.runBatch();
      const foreign = await db.notification.findFirstOrThrow({ where: { sourceEventId: theirs.event.id } });
      const anonymous = await new Browser().prepare();
      assert.equal((await anonymous.request('/notifications')).status, 401);
      assert.equal((await staff.browser.request('/notifications')).status, 403);
      assert.equal((await student.browser.request(`/notifications/${foreign.id}/read`, 'PATCH', {})).status, 404);
      assert.equal((await student.browser.request(`/notifications?cursor=${foreign.id}`)).status, 422);
      assert.equal((await student.browser.request(`/notifications?recipientId=${other.user.id}`)).status, 422);
      const expected = await db.notification.count({ where: { recipientId: student.user.id } });
      const ids = new Set<string>(); let cursor: string | null = null;
      do {
        const page = await student.browser.request('/notifications?limit=2' + (cursor ? `&cursor=${cursor}` : ''));
        assert.equal(page.status, 200); assert.equal(page.body.unreadCount, expected);
        for (const row of page.body.items) { assert(!ids.has(row.id)); assert.notEqual(row.id, foreign.id); ids.add(row.id); }
        cursor = page.body.nextCursor;
      } while (cursor);
      assert.equal(ids.size, expected);
      const id = [...ids][0]!;
      const [a, b] = await Promise.all([student.browser.request(`/notifications/${id}/read`, 'PATCH', {}), student.browser.request(`/notifications/${id}/read`, 'PATCH', {})]);
      assert.equal(a.status, 200); assert.deepEqual(a.body, b.body); assert(a.body.readAt);
      const device = await new Browser().prepare(); device.jar.set('spoonate_session', student.browser.jar.get('spoonate_session')!);
      const saved = await device.request('/notifications');
      assert.equal(saved.body.unreadCount, expected - 1);
      assert.equal(saved.body.items.find((row: { id: string }) => row.id === id).readAt, a.body.readAt);
      assert.equal((await db.notification.findUniqueOrThrow({ where: { id: foreign.id } })).readAt, null);
      await db.session.update({ where: { id: student.session.id }, data: { createdAt: new Date(Date.now() - 120000), expiresAt: new Date(Date.now() - 60000) } });
      assert.equal((await device.request('/notifications')).status, 401);
      assert.equal((await device.request(`/notifications/${id}/read`, 'PATCH', {})).status, 401);
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
});
