import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed } from '../../src/services/provision.js';
import type { Role } from '../../src/generated/prisma/client.js';
const url = process.env.PICKUP_TEST_DATABASE_URL;
test('canteen-controlled collection and atomic staff handover', { skip: !url }, async t => {
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
    constructor(readonly target = base, readonly portal = 'student') {}
    async request(path: string, method = 'GET', body?: object, key?: string) {
      const response = await fetch(this.target + '/' + this.portal + path, { method, headers: { Origin: this.portal === 'student' ? config.FRONTEND_ORIGIN : this.portal === 'canteen' ? config.CANTEEN_ORIGIN : config.ADMIN_ORIGIN,
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
    const browser = await new Browser(base, role.toLowerCase()).prepare(); browser.jar.set(`spoonate_${browser.portal}_session`, token);
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

  const collect = (order: Order, browser = staff.browser, key = randomUUID()) =>
    browser.request(`/orders/${order.id}/collect`, 'POST', { expectedVersion: order.version }, key);
  try {
    await t.test('READY creates no code and staff collect without one', async () => {
      const order = await ready();
      assert.equal(await db.pickupCredential.count({ where: { orderId: order.id } }), 0);
      assert.deepEqual((await student.browser.request(`/orders/${order.id}/pickup-code`)).body, { code: null });
      const result = await collect(order);
      assert.equal(result.status, 200);
      assert.equal(result.body.status, 'COLLECTED');
      assert.equal(result.body.pickupVerifiedBy, staff.user.id);
      assert.equal(result.body.collectedAt, now.toISOString());
      assert.equal(result.body.version, order.version + 1);
    });
    await t.test('only active own-canteen staff with CSRF and an idempotency key can collect', async () => {
      const order = await ready();
      for (const browser of [student.browser, admin.browser]) assert.equal((await collect(order, browser)).status, 403);
      assert.equal((await collect(order, otherStaff.browser)).status, 404);
      assert.equal((await collect(order, await new Browser(base, 'canteen').prepare())).status, 401);
      assert.equal((await staff.browser.request(`/orders/${order.id}/collect`, 'POST', { expectedVersion: order.version })).status, 422);
      const noCsrf = new Browser(base, 'canteen'); noCsrf.jar = new Map(staff.browser.jar);
      assert.equal((await collect(order, noCsrf)).status, 403);
      await db.session.update({ where: { id: staffTwo.session.id }, data: { revokedAt: new Date() } });
      assert.equal((await collect(order, staffTwo.browser)).status, 401);
      await db.session.update({ where: { id: staffTwo.session.id }, data: { revokedAt: null } });
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'READY');
      assert.equal((await other.browser.request(`/orders/${order.id}/pickup-code`)).status, 404);
    });
    await t.test('early collection, stale versions and extra input cannot advance orders', async () => {
      const early = await placed();
      assert.equal((await collect(early)).status, 409);
      let order = await advance(early, 'accept'); assert.equal((await collect(order)).status, 409);
      order = await advance(order, 'prepare'); assert.equal((await collect(order)).status, 409);
      order = await advance(order, 'ready');
      assert.equal((await collect({ ...order, version: order.version - 1 })).status, 409);
      assert.equal((await staff.browser.request(`/orders/${order.id}/collect`, 'POST', { expectedVersion: order.version, code: '42' }, randomUUID())).status, 422);
      assert.equal((await collect(order)).status, 200);
    });
    await t.test('simultaneous handovers record exactly one collection and preserve dated history', async () => {
      const order = await ready();
      const responses = await Promise.all([collect(order), collect(order, staffTwo.browser)]);
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
      assert.equal((await collect(order)).status, 409);
    });
    await t.test('lost-response and simultaneous same-key retries return the same result without another handover', async () => {
      const order = await ready(); const key = randomUUID();
      const [a, b] = await Promise.all([collect(order, staff.browser, key), collect(order, staff.browser, key)]);
      assert.equal(a.status, 200); assert.deepEqual(a.body, b.body);
      assert.deepEqual((await collect(order, staff.browser, key)).body, a.body);
      assert.equal((await collect({ ...order, version: order.version + 1 }, staff.browser, key)).body.error.code, 'IDEMPOTENCY_CONFLICT');
      assert.equal(await db.idempotencyKey.count({ where: { actorId: staff.user.id, action: 'ORDER_COLLECT', key } }), 1);
      assert.equal(await db.orderEvent.count({ where: { orderId: order.id, newStatus: 'COLLECTED' } }), 1);
    });
    await t.test('collection rolls back completely when the outbox fails and the same command can retry safely', async () => {
      const order = await ready(); const key = randomUUID();
      await db.$executeRawUnsafe("CREATE FUNCTION phase10_fail_collection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload->>'status' = 'COLLECTED' THEN RAISE EXCEPTION 'test collection rollback'; END IF; RETURN NEW; END $$");
      await db.$executeRawUnsafe('CREATE TRIGGER phase10_fail_collection BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION phase10_fail_collection()');
      try { assert.equal((await collect(order, staff.browser, key)).status, 500); }
      finally { await db.$executeRawUnsafe('DROP TRIGGER phase10_fail_collection ON outbox_events'); await db.$executeRawUnsafe('DROP FUNCTION phase10_fail_collection()'); }
      const unchanged = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(unchanged.status, 'READY'); assert.equal(unchanged.collectedAt, null); assert.equal(unchanged.pickupVerifiedBy, null);
      assert.equal(await db.orderEvent.count({ where: { orderId: order.id, newStatus: 'COLLECTED' } }), 0);
      assert.equal(await db.idempotencyKey.count({ where: { actorId: staff.user.id, action: 'ORDER_COLLECT', key } }), 0);
      assert.equal((await collect(order, staff.browser, key)).status, 200);
    });

    await t.test('paused canteens and existing READY orders need no credential or code', async () => {
      const order = await ready();
      await db.pickupCredential.create({ data: { orderId: order.id, encryptedCode: 'obsolete-credential', failedAttempts: 5, windowEndsAt: new Date(now.getTime() + 600000) } });
      const current = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      assert.equal((await staff.browser.request(`/canteens/${canteen.id}/availability`, 'PATCH', { expectedVersion: current.version, acceptingOrders: false })).status, 200);
      now = new Date(now.getTime() + 86400000);
      assert.equal((await collect(order)).status, 200);
      assert.equal(await db.pickupCredential.count({ where: { orderId: order.id } }), 0);
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
});
