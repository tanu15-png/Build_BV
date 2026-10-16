import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed } from '../../src/services/provision.js';
import { createOutboxWorker } from '../../src/services/outbox.js';
import { encryptPickupCode, pickupStaffRateKey } from '../../src/services/pickup.js';
import { contracts } from '../../src/schemas/contracts.js';
import type { Role, OrderStatus } from '../../src/generated/prisma/client.js';
const url = process.env.PICKUP_TEST_DATABASE_URL;
test('private ready-only pickup credentials and atomic staff handover', { skip: !url }, async t => {
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
  let now = new Date('2026-10-16T10:00:00.000Z');
  const server = createApp(config, db, () => {}, fetch, { clock: async () => now }).listen(0, '127.0.0.1');
  await once(server, 'listening'); const port = server.address(); assert(port && typeof port !== 'string');
  const base = `http://127.0.0.1:${port.port}/api/v1`;
  class Browser {
    jar = new Map<string, string>(); csrf = '';
    constructor(readonly target = base) {}
    async request(path: string, method = 'GET', body?: object, key?: string) {
      const response = await fetch(this.target + path, { method, headers: { Origin: config.FRONTEND_ORIGIN,
        Cookie: [...this.jar].map(([name, value]) => `${name}=${value}`).join('; '),
        ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0]!.split('='); this.jar.set(name!, value!); }
      return { status: response.status, body: await response.json(), headers: response.headers };
    }
    async prepare() { this.csrf = (await this.request('/auth/csrf')).body.csrfToken; return this; }
  }
  async function fixture(role: Role, email: string, canteenId?: string) {
    const user = await db.user.create({ data: { email, name: 'Pickup Test', supabaseSubject: randomUUID(), emailVerifiedAt: new Date(), roles: { create: { role } } } });
    const membership = canteenId ? await db.canteenMembership.create({ data: { userId: user.id, canteenId, codeVersion: 1 } }) : null;
    const token = randomBytes(32).toString('hex');
    const session = await db.session.create({ data: { userId: user.id, role, canteenId, membershipId: membership?.id,
      tokenHash: createHmac('sha256', config.SESSION_SECRET).update(`session:${token}`).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    const browser = await new Browser().prepare(); browser.jar.set('spoonate_session', token);
    return { user, session, browser };
  }
  const student = await fixture('STUDENT', 'pickup@banasthali.in');
  const other = await fixture('STUDENT', 'other-pickup@banasthali.in');
  const staff = await fixture('CANTEEN', 'pickup-staff@example.edu', canteen.id);
  const staffTwo = await fixture('CANTEEN', 'pickup-staff-two@example.edu', canteen.id);
  const otherCanteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'shanu' } });
  const otherStaff = await fixture('CANTEEN', 'pickup-other-staff@example.edu', otherCanteen.id);
  const admin = await fixture('ADMIN', 'pickup-admin@example.edu');
  const item = await db.menuItem.findFirstOrThrow({ where: { canteenId: canteen.id } });
  type Order = { id: string; version: number; orderCode: string; status: string };
  async function placed() {
    const cart = (await student.browser.request('/cart')).body;
    const filled = (await student.browser.request('/cart/items', 'POST', { expectedVersion: cart.version, menuItemId: item.id, quantity: 1 })).body;
    const created = await student.browser.request('/orders', 'POST', { expectedVersion: filled.version, quote: filled.quote, pickupAt: new Date(now.getTime() + 1200000).toISOString() }, randomUUID());
    assert.equal(created.status, 201); return created.body as Order;
  }
  async function advance(order: Order, action: string) {
    const response = await staff.browser.request(`/orders/${order.id}/${action}`, 'POST', { expectedVersion: order.version }, randomUUID());
    assert.equal(response.status, 200); return response.body as Order;
  }
  async function ready() { let order = await placed(); for (const action of ['accept', 'prepare', 'ready']) order = await advance(order, action); return order; }
  async function codeFor(order: Order) {
    const response = await student.browser.request(`/orders/${order.id}/pickup-code`);
    assert.equal(response.status, 200); assert.match(response.body.code, /^(?:[1-9][0-9]?|100)$/); return response.body.code as string;
  }
  const collect = (order: Order, code: string, browser = staff.browser, key = randomUUID()) => browser.request(`/orders/${order.id}/collect`, 'POST', { expectedVersion: order.version, code }, key);
  try {
    await t.test('the code is generated atomically on READY, stays private and survives reloads without regeneration', async () => {
      let order = await placed();
      for (const action of ['accept', 'prepare']) {
        assert.deepEqual((await student.browser.request(`/orders/${order.id}/pickup-code`)).body, { code: null });
        assert.equal(await db.pickupCredential.count({ where: { orderId: order.id } }), 0);
        order = await advance(order, action);
      }
      assert.equal(await db.pickupCredential.count({ where: { orderId: order.id } }), 0);
      const readyKey = randomUUID();
      const body = { expectedVersion: order.version };
      const marked = await staff.browser.request(`/orders/${order.id}/ready`, 'POST', body, readyKey);
      assert.equal(marked.status, 200); order = marked.body;
      const code = await codeFor(order);
      assert.equal(await db.pickupCredential.count({ where: { orderId: order.id } }), 1);
      const before = await db.pickupCredential.findUniqueOrThrow({ where: { orderId: order.id } });
      assert.notEqual(before.encryptedCode, code);
      assert.equal((await staff.browser.request(`/orders/${order.id}/ready`, 'POST', body, readyKey)).status, 200);
      assert.equal(await codeFor(order), code);
      assert.deepEqual(await db.pickupCredential.findUniqueOrThrow({ where: { orderId: order.id } }), before);
      const device = await new Browser().prepare(); device.jar.set('spoonate_session', student.browser.jar.get('spoonate_session')!);
      assert.equal((await device.request(`/orders/${order.id}/pickup-code`)).body.code, code);
      for (const browser of [student.browser, staff.browser, admin.browser]) {
        const detail = (await browser.request(`/orders/${order.id}`)).body;
        assert(!('pickupCode' in detail)); assert(!('encryptedCode' in detail)); assert(!('pickupCredential' in detail));
        const list = (await browser.request('/orders')).body;
        assert(list.items.every((row: object) => !('pickupCredential' in row) && !('pickupCode' in row)));
      }
      const worker = createOutboxWorker(db, config); await worker.runBatch();
      const notifications = (await student.browser.request('/notifications')).body;
      assert(notifications.items.every((row: object) => !('code' in row)));
    });
    await t.test('single-digit and 100 pickup codes display and collect through the same private API', async () => {
      for (const code of ['1', '9', '100']) {
        const order = await ready();
        await db.pickupCredential.update({ where: { orderId: order.id }, data: { encryptedCode: encryptPickupCode(code, order.id, config.OTP_SECRET) } });
        assert.equal(await codeFor(order), code);
        assert.equal((await collect(order, code)).status, 200);
      }
    });
    await t.test('only the owning student can fetch the private code; only active own-canteen staff can collect', async () => {
      const order = await ready(); const code = await codeFor(order);
      const anonymous = await new Browser().prepare();
      assert.equal((await anonymous.request(`/orders/${order.id}/pickup-code`)).status, 401);
      assert.equal((await other.browser.request(`/orders/${order.id}/pickup-code`)).status, 404);
      assert.equal((await staff.browser.request(`/orders/${order.id}/pickup-code`)).status, 403);
      assert.equal((await admin.browser.request(`/orders/${order.id}/pickup-code`)).status, 403);
      assert.equal((await collect(order, code, student.browser)).status, 403);
      assert.equal((await collect(order, code, admin.browser)).status, 403);
      assert.equal((await collect(order, code, otherStaff.browser)).status, 404);
      assert.equal((await collect(order, code, anonymous)).status, 401);
      assert.equal((await staff.browser.request(`/orders/${order.id}/collect`, 'POST', { expectedVersion: order.version, code })).status, 422);
      const noCsrf = new Browser(); noCsrf.jar = new Map(staff.browser.jar);
      assert.equal((await noCsrf.request(`/orders/${order.id}/collect`, 'POST', { expectedVersion: order.version, code }, randomUUID())).status, 403);
      await db.session.update({ where: { id: staffTwo.session.id }, data: { revokedAt: new Date() } });
      assert.equal((await collect(order, code, staffTwo.browser)).status, 401);
      await db.session.update({ where: { id: staffTwo.session.id }, data: { revokedAt: null } });
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'READY');
    });
    await t.test('early, malformed, missing and stale-version verification never advances the order', async () => {
      const early = await placed();
      assert.equal((await collect(early, '42')).status, 409);
      let preparing = await advance(early, 'accept'); preparing = await advance(preparing, 'prepare');
      assert.equal((await collect(preparing, '42')).status, 409);
      const order = await advance(preparing, 'ready'); const code = await codeFor(order);
      for (const bad of ['', '0', '01', '101', order.orderCode, undefined, null, 42]) {
        assert.equal((await staff.browser.request(`/orders/${order.id}/collect`, 'POST', { expectedVersion: order.version, code: bad }, randomUUID())).status, 422);
      }
      assert.equal((await collect({ ...order, version: order.version - 1 }, code)).status, 409);
      assert.equal((await db.pickupCredential.findUniqueOrThrow({ where: { orderId: order.id } })).failedAttempts, 0);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'READY');
    });
    await t.test('wrong-code counters persist, apply across staff and replicas, and reset only after the cooldown', async () => {
      const order = await ready(); const code = await codeFor(order); const wrong = code === '42' ? '43' : '42';
      assert.equal((await collect(order, wrong)).status, 422);
      assert.equal((await collect(order, wrong, staffTwo.browser)).status, 422);
      now = new Date(now.getTime() + 30000);
      assert.equal((await collect(order, wrong)).status, 422);
      assert.equal((await collect(order, wrong, staffTwo.browser)).status, 422);
      const fifth = await collect(order, wrong);
      assert.equal(fifth.status, 429); assert.equal(fifth.headers.get('retry-after'), '600');
      assert.equal((await db.pickupCredential.findUniqueOrThrow({ where: { orderId: order.id } })).failedAttempts, 5);
      assert.equal((await collect(order, code, staffTwo.browser)).status, 429);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'READY');
      assert.equal(await db.auditLog.count({ where: { action: 'PICKUP_VERIFY_FAILED', target: `order:${order.id}` } }), 5);
      const persisted = await db.auditLog.findMany({ where: { target: `order:${order.id}` } });
      assert(persisted.every(row => !JSON.stringify(row.metadata).includes('encryptedCode') && !JSON.stringify(row.metadata).includes('pickupCode')));
      now = new Date(now.getTime() + 600001);
      assert.equal((await collect(order, code)).status, 200);
    });
    await t.test('the staff-wide attempt limit cannot be bypassed by switching orders', async () => {
      const order = await ready(); const code = await codeFor(order);
      const key = pickupStaffRateKey(staff.user.id, config.OTP_SECRET);
      await db.rateLimit.upsert({ where: { key }, create: { key, count: 20, windowEndsAt: new Date(now.getTime() + 60000) }, update: { count: 20, windowEndsAt: new Date(now.getTime() + 60000) } });
      assert.equal((await collect(order, code)).status, 429);
      assert.equal((await db.pickupCredential.findUniqueOrThrow({ where: { orderId: order.id } })).failedAttempts, 0);
      now = new Date(now.getTime() + 60001);
      assert.equal((await collect(order, code)).status, 200);
    });
    await t.test('simultaneous handovers record exactly one collection, consume the code and preserve dated history', async () => {
      const order = await ready(); const code = await codeFor(order);
      const responses = await Promise.all([collect(order, code), collect(order, code, staffTwo.browser)]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      const winner = responses.find(response => response.status === 200)!;
      const loser = responses.find(response => response.status === 409)!;
      assert.equal(loser.body.error.code, 'ORDER_ALREADY_COLLECTED');
      assert.equal(winner.body.status, 'COLLECTED'); assert.equal(winner.body.version, order.version + 1);
      assert.equal(winner.body.collectedAt, now.toISOString()); assert(winner.body.pickupVerifiedBy);
      assert.equal(await db.orderEvent.count({ where: { orderId: order.id, newStatus: 'COLLECTED' } }), 1);
      assert.equal(await db.outboxEvent.count({ where: { event: { orderId: order.id, newStatus: 'COLLECTED' } } }), 1);
      assert.equal(await db.auditLog.count({ where: { target: `order:${order.id}`, action: 'ORDER_COLLECTED' } }), 1);
      assert.equal(await db.pickupCredential.count({ where: { orderId: order.id } }), 0);
      assert.deepEqual((await student.browser.request(`/orders/${order.id}/pickup-code`)).body, { code: null });
      assert.equal(await db.orderCodeAllocation.count({ where: { orderId: order.id } }), 1);
      assert.equal((await collect(order, code)).status, 409);
    });
    await t.test('lost-response and simultaneous same-key retries return the same result without another handover', async () => {
      const order = await ready(); const code = await codeFor(order); const key = randomUUID();
      const [a, b] = await Promise.all([collect(order, code, staff.browser, key), collect(order, code, staff.browser, key)]);
      assert.equal(a.status, 200); assert.deepEqual(a.body, b.body);
      assert.deepEqual((await collect(order, code, staff.browser, key)).body, a.body);
      assert.equal((await collect(order, code === '42' ? '43' : '42', staff.browser, key)).body.error.code, 'IDEMPOTENCY_CONFLICT');
      assert.equal(await db.idempotencyKey.count({ where: { actorId: staff.user.id, action: 'ORDER_COLLECT', key } }), 1);
      assert.equal(await db.orderEvent.count({ where: { orderId: order.id, newStatus: 'COLLECTED' } }), 1);
    });
    await t.test('collection rolls back completely when the outbox fails and the same command can retry safely', async () => {
      const order = await ready(); const code = await codeFor(order); const key = randomUUID();
      await db.$executeRawUnsafe("CREATE FUNCTION phase10_fail_collection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload->>'status' = 'COLLECTED' THEN RAISE EXCEPTION 'test collection rollback'; END IF; RETURN NEW; END $$");
      await db.$executeRawUnsafe('CREATE TRIGGER phase10_fail_collection BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION phase10_fail_collection()');
      try { assert.equal((await collect(order, code, staff.browser, key)).status, 500); }
      finally { await db.$executeRawUnsafe('DROP TRIGGER phase10_fail_collection ON outbox_events'); await db.$executeRawUnsafe('DROP FUNCTION phase10_fail_collection()'); }
      const unchanged = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(unchanged.status, 'READY'); assert.equal(unchanged.collectedAt, null); assert.equal(unchanged.pickupVerifiedBy, null);
      assert.equal(await codeFor(order), code);
      assert.equal(await db.orderEvent.count({ where: { orderId: order.id, newStatus: 'COLLECTED' } }), 0);
      assert.equal(await db.idempotencyKey.count({ where: { actorId: staff.user.id, action: 'ORDER_COLLECT', key } }), 0);
      assert.equal((await collect(order, code, staff.browser, key)).status, 200);
    });
    await t.test('a failed READY transaction does not leave a pickup credential behind', async () => {
      let order = await placed(); order = await advance(order, 'accept'); order = await advance(order, 'prepare');
      await db.$executeRawUnsafe("CREATE FUNCTION phase10_fail_ready() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload->>'status' = 'READY' THEN RAISE EXCEPTION 'test ready rollback'; END IF; RETURN NEW; END $$");
      await db.$executeRawUnsafe('CREATE TRIGGER phase10_fail_ready BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION phase10_fail_ready()');
      try { assert.equal((await staff.browser.request(`/orders/${order.id}/ready`, 'POST', { expectedVersion: order.version }, randomUUID())).status, 500); }
      finally { await db.$executeRawUnsafe('DROP TRIGGER phase10_fail_ready ON outbox_events'); await db.$executeRawUnsafe('DROP FUNCTION phase10_fail_ready()'); }
      assert.equal(await db.pickupCredential.count({ where: { orderId: order.id } }), 0);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'PREPARING');
    });
    await t.test('late pickup at a paused canteen works and the public daily reference never substitutes for the private code', async () => {
      const order = await ready(); const code = await codeFor(order);
      const current = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      await staff.browser.request(`/canteens/${canteen.id}/availability`, 'PATCH', { expectedVersion: current.version, acceptingOrders: false });
      now = new Date(now.getTime() + 86400000);
      assert.equal((await collect(order, code)).status, 200);
      const paused = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      await staff.browser.request(`/canteens/${canteen.id}/availability`, 'PATCH', { expectedVersion: paused.version, acceptingOrders: true });
    });
    await t.test('old ready orders get one stable code on first student access and codes remain tied to UUIDs across dates', async () => {
      const orders = [];
      for (const date of ['2026-10-01', '2026-10-02']) {
        orders.push(await db.order.create({ data: { studentId: student.user.id, canteenId: canteen.id, status: 'READY', totalPaise: 1000, pickupAt: now, codeDay: new Date(date), orderCode: 'A01' } }));
      }
      const a = orders[0]!; const b = orders[1]!;
      const firstCode = await codeFor({ ...a, orderCode: a.orderCode! }); assert.equal(await codeFor({ ...a, orderCode: a.orderCode! }), firstCode);
      await codeFor({ ...b, orderCode: b.orderCode! });
      // Deterministic distinct credentials make the wrong-UUID test independent of random collisions.
      await db.pickupCredential.update({ where: { orderId: a.id }, data: { encryptedCode: encryptPickupCode('57', a.id, config.OTP_SECRET) } });
      await db.pickupCredential.update({ where: { orderId: b.id }, data: { encryptedCode: encryptPickupCode('86', b.id, config.OTP_SECRET) } });
      assert.equal((await collect({ ...a, orderCode: a.orderCode! }, '86')).status, 422);
      assert.equal((await collect({ ...a, orderCode: a.orderCode! }, '57')).status, 200);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: b.id } })).status, 'READY');
      assert.equal(await codeFor({ ...b, orderCode: b.orderCode! }), '86');
    });
    await t.test('application-role RLS supports student retrieval and staff collection without browser-role table access', async () => {
      const role = 'phase10_app_' + randomBytes(6).toString('hex');
      await db.$executeRawUnsafe(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS`);
      const grants = spawnSync('psql', ['-h', address.hostname, '-p', address.port || '5432', '-U', decodeURIComponent(address.username), '-d', address.pathname.slice(1), '-v', `app_role=${role}`, '-f', 'prisma/application-role.sql'], { env: { ...process.env, PGPASSWORD: decodeURIComponent(address.password) }, encoding: 'utf8', timeout: 30000 });
      assert.equal(grants.status, 0, grants.stderr);
      const appUrl = new URL(url); appUrl.username = role; appUrl.password = '';
      const appDb = createPrisma({ ...config, DATABASE_URL: appUrl.toString() });
      const appServer = createApp(config, appDb, () => {}, fetch, { clock: async () => now }).listen(0, '127.0.0.1');
      await once(appServer, 'listening'); const appAddress = appServer.address(); assert(appAddress && typeof appAddress !== 'string');
      const appBase = `http://127.0.0.1:${appAddress.port}/api/v1`;
      const studentDevice = new Browser(appBase); studentDevice.jar = new Map(student.browser.jar); studentDevice.csrf = student.browser.csrf;
      const staffDevice = new Browser(appBase); staffDevice.jar = new Map(staff.browser.jar); staffDevice.csrf = staff.browser.csrf;
      try {
        const order = await ready();
        const result = await studentDevice.request(`/orders/${order.id}/pickup-code`); assert.equal(result.status, 200);
        assert.equal((await collect(order, result.body.code, staffDevice)).status, 200);
        assert.equal((await staffDevice.request(`/orders/${order.id}/pickup-code`)).status, 403);
        const policies = await db.$queryRaw<Array<{ relrowsecurity: boolean; public_access: boolean }>>`SELECT relrowsecurity, EXISTS (SELECT 1 FROM aclexplode(relacl) WHERE grantee = 0 AND privilege_type = 'SELECT') AS public_access FROM pg_class WHERE oid = 'public.pickup_credentials'::regclass`;
        assert(policies[0]!.relrowsecurity); assert.equal(policies[0]!.public_access, false);
      } finally { await new Promise<void>(resolve => appServer.close(() => resolve())); await appDb.$disconnect(); }
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
});
