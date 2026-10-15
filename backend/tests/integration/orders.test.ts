import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed } from '../../src/services/provision.js';
import { cartSchema, orderSchema, contracts } from '../../src/schemas/contracts.js';
import type { Role } from '../../src/generated/prisma/client.js';

const url = process.env.ORDER_TEST_DATABASE_URL;
test('transactional checkout, code allocation and fulfillment with isolated PostgreSQL', { skip: !url }, async t => {
  assert(url); const address = new URL(url);
  assert(['localhost', '127.0.0.1'].includes(address.hostname) && address.pathname.includes('test'));
  assert.notEqual(url, process.env.DATABASE_URL);
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url }, encoding: 'utf8', timeout: 180000 });
  assert.equal(migration.status, 0, migration.stderr);
  const config = loadConfig({ DATABASE_URL: url, APP_ENV: 'test', NODE_ENV: 'test', FRONTEND_ORIGIN: 'http://localhost:5173',
    SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SEED_DEVELOPMENT_DATA: 'true', LOG_LEVEL: 'silent', DB_TIMEOUT_MS: '10000' });
  const db = createPrisma(config); await seed(db, config);
  const canteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'bella-bite' } });
  const other = await db.canteen.findUniqueOrThrow({ where: { slug: 'shanu' } });
  const item = await db.menuItem.findFirstOrThrow({ where: { canteenId: canteen.id } });
  const otherItem = await db.menuItem.findFirstOrThrow({ where: { canteenId: other.id } });
  let now = new Date('2026-11-01T10:00:00.000Z');
  // Force collisions; the allocator must recover without aborting the transaction.
  const server = createApp(config, db, () => {}, fetch, { clock: async () => now, codeIndex: () => 0 }).listen(0, '127.0.0.1');
  await once(server, 'listening'); const port = server.address(); assert(port && typeof port !== 'string');
  const base = 'http://127.0.0.1:' + port.port + '/api/v1';
  class Browser {
    jar = new Map<string, string>(); csrf = '';
    async request(path: string, method = 'GET', body?: object, key?: string) {
      const response = await fetch(base + path, { method, headers: { Origin: config.FRONTEND_ORIGIN,
        Cookie: [...this.jar].map(([name, value]) => name + '=' + value).join('; '),
        ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0]!.split('='); this.jar.set(name!, value!); }
      return { status: response.status, body: await response.json() };
    }
    async prepare() { this.csrf = (await this.request('/auth/csrf')).body.csrfToken; return this; }
  }
  async function fixture(role: Role, email: string, canteenId?: string) {
    const user = await db.user.create({ data: { email, name: 'Order Test User', supabaseSubject: randomUUID(), emailVerifiedAt: new Date(), roles: { create: { role } } } });
    const membership = canteenId ? await db.canteenMembership.create({ data: { userId: user.id, canteenId, codeVersion: 1 } }) : null;
    const token = randomBytes(32).toString('hex');
    const session = await db.session.create({ data: { userId: user.id, role, canteenId, membershipId: membership?.id,
      tokenHash: createHmac('sha256', config.SESSION_SECRET).update('session:' + token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    const browser = await new Browser().prepare(); browser.jar.set('spoonate_session', token);
    return { user, session, browser };
  }
  const student = await fixture('STUDENT', 'orders@banasthali.in');
  const second = await fixture('STUDENT', 'second-order@banasthali.in');
  const staff = await fixture('CANTEEN', 'orders-staff@example.edu', canteen.id);
  const staffTwo = await fixture('CANTEEN', 'orders-staff-two@example.edu', canteen.id);
  const otherStaff = await fixture('CANTEEN', 'other-orders-staff@example.edu', other.id);
  const admin = await fixture('ADMIN', 'orders-admin@example.edu');
  const cart = async (browser = student.browser) => { const response = await browser.request('/cart'); assert.equal(response.status, 200); return cartSchema.parse(response.body); };
  async function fill(browser = student.browser, menuItemId = item.id) {
    const before = await cart(browser);
    const result = await browser.request('/cart/items', 'POST', { expectedVersion: before.version, menuItemId, quantity: 2 });
    assert.equal(result.status, 200); return cartSchema.parse(result.body);
  }
  const bodyFor = (value: Awaited<ReturnType<typeof cart>>) => ({ expectedVersion: value.version, quote: value.quote, pickupAt: new Date(now.getTime() + 20 * 60000).toISOString() });
  let first: ReturnType<typeof orderSchema.parse>;
  let originalBody: ReturnType<typeof bodyFor>; let originalKey: string;
  try {
    await t.test('checkout requires student session, CSRF, bounded key, strict fields and offset-aware future pickup', async () => {
      const value = await fill(); const body = bodyFor(value);
      const anonymous = await new Browser().prepare();
      assert.equal((await anonymous.request('/orders', 'POST', body, randomUUID())).status, 401);
      assert.equal((await staff.browser.request('/orders', 'POST', body, randomUUID())).status, 403);
      assert.equal((await student.browser.request('/orders', 'POST', body)).status, 422);
      assert.equal((await student.browser.request('/orders', 'POST', body, 'x'.repeat(129))).status, 422);
      for (const pickupAt of ['2026-11-01T10:20:00', now.toISOString(), new Date(now.getTime() - 1000).toISOString(), new Date(now.getTime() + 61 * 60000).toISOString()]) {
        assert.equal((await student.browser.request('/orders', 'POST', { ...body, pickupAt }, randomUUID())).status, 422);
      }
      assert.equal((await student.browser.request('/orders', 'POST', { ...body, studentId: second.user.id, totalPaise: 1 }, randomUUID())).status, 422);
      assert.equal(await db.order.count(), 0); assert.equal((await cart()).items.length, 1);
    });
    await t.test('simultaneous same-key submissions create one order, snapshot, code, event and outbox entry', async () => {
      const before = await cart(); const body = bodyFor(before); const key = randomUUID(); originalBody = body; originalKey = key;
      const [a, b] = await Promise.all([student.browser.request('/orders', 'POST', body, key), student.browser.request('/orders', 'POST', body, key)]);
      assert.equal(a.status, 201); assert.equal(b.status, 201); assert.deepEqual(a.body, b.body);
      first = orderSchema.parse(a.body); assert.equal(first.totalPaise, item.pricePaise * 2); assert.equal(first.orderCode, '000'); assert.equal(first.status, 'RECEIVED');
      assert.equal(first.executionMode, 'TEST'); assert.equal(first.paymentStatus, 'NOT_REQUIRED_TEST');
      assert.equal(await db.order.count(), 1); assert.equal(await db.orderCodeAllocation.count(), 1); assert.equal(await db.orderEvent.count(), 1); assert.equal(await db.outboxEvent.count(), 1);
      assert.equal((await cart()).items.length, 0); assert.equal((await cart()).canteenId, null);
      assert.equal((await student.browser.request('/orders', 'POST', { ...body, pickupAt: new Date(now.getTime() + 30 * 60000).toISOString() }, key)).body.error.code, 'IDEMPOTENCY_CONFLICT');
    });
    await t.test('different keys racing for the same cart produce one order, without a partial loser', async () => {
      const value = await fill(); const body = bodyFor(value); const before = await db.order.count();
      assert.equal((await student.browser.request('/orders', 'POST', originalBody, originalKey)).body.id, first.id);
      assert.equal((await cart()).version, value.version);
      const responses = await Promise.all([student.browser.request('/orders', 'POST', body, randomUUID()), student.browser.request('/orders', 'POST', body, randomUUID())]);
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
      assert.equal(await db.order.count(), before + 1); assert.equal(await db.idempotencyKey.count({ where: { action: 'CREATE_ORDER' } }), before + 1);
    });
    await t.test('collision fallback and concurrent cross-canteen allocation produce campus-wide unique codes', async () => {
      const a = bodyFor(await fill()); const b = bodyFor(await fill(second.browser, otherItem.id));
      const responses = await Promise.all([student.browser.request('/orders', 'POST', a, randomUUID()), second.browser.request('/orders', 'POST', b, randomUUID())]);
      assert(responses.every(r => r.status === 201)); assert.notEqual(responses[0]!.body.orderCode, responses[1]!.body.orderCode);
      const rows = await db.order.findMany(); assert.equal(new Set(rows.map(row => row.orderCode)).size, rows.length);
    });
    await t.test('reads, cursors and filters remain scoped to the student or owning canteen', async () => {
      assert.equal((await second.browser.request('/orders/' + first.id)).status, 404);
      assert.equal((await otherStaff.browser.request('/orders/' + first.id)).status, 404);
      assert.equal((await staff.browser.request('/orders/' + first.id)).status, 200);
      const page = await student.browser.request('/orders?limit=1'); assert.equal(page.status, 200); contracts['GET /orders']!.response.parse(page.body);
      assert(page.body.nextCursor); const next = await student.browser.request('/orders?limit=1&cursor=' + page.body.nextCursor); assert.equal(next.status, 200); assert.notEqual(page.body.items[0].id, next.body.items[0].id);
      const foreign = (await second.browser.request('/orders')).body.items[0].id;
      assert.equal((await student.browser.request('/orders?cursor=' + foreign)).status, 422);
      assert.equal((await staff.browser.request('/orders?canteenId=' + other.id)).status, 403);
      assert.equal((await student.browser.request('/orders?canteenId=' + other.id)).body.items.length, 0);
      assert.equal((await admin.browser.request('/orders')).body.items.length, await db.order.count());
    });
    await t.test('changed menu/category prices and stale carts reject checkout with a fresh summary', async () => {
      const value = await fill(); const body = bodyFor(value);
      await db.menuItem.update({ where: { id: item.id }, data: { pricePaise: item.pricePaise + 100, version: { increment: 1 } } });
      const stale = await student.browser.request('/orders', 'POST', body, randomUUID());
      assert.equal(stale.status, 409); assert.equal(stale.body.error.code, 'QUOTE_CHANGED'); assert.equal(stale.body.error.details.cart.totalPaise, (item.pricePaise + 100) * 2);
      assert.equal((await cart()).items.length, 1);
      const changed = await student.browser.request('/orders', 'POST', { ...bodyFor(await cart()), expectedVersion: value.version - 1 }, randomUUID());
      assert.equal(changed.body.error.code, 'CART_CHANGED');
      assert.equal((await db.orderItem.findFirstOrThrow({ where: { orderId: first.id } })).unitPricePaise, item.pricePaise);
    });
    await t.test('a committed pause blocks checkout and resume requires a refreshed quote', async () => {
      const value = await cart(); const before = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      await staff.browser.request('/canteens/' + canteen.id + '/availability', 'PATCH', { expectedVersion: before.version, acceptingOrders: false });
      assert.equal((await student.browser.request('/orders', 'POST', bodyFor(value), randomUUID())).status, 409);
      const current = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      await staff.browser.request('/canteens/' + canteen.id + '/availability', 'PATCH', { expectedVersion: current.version, acceptingOrders: true });
      assert.equal((await student.browser.request('/orders', 'POST', bodyFor(value), randomUUID())).status, 409);
      assert.equal((await student.browser.request('/orders', 'POST', bodyFor(await cart()), randomUUID())).status, 201);
    });
    await t.test('racing pause and menu-price changes have a defined winner against checkout', async () => {
      for (const action of ['pause', 'price']) {
        const value = await fill(); const before = await db.order.count();
        const can = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
        const menu = await db.menuItem.findUniqueOrThrow({ where: { id: item.id } });
        const [checkout, update] = await Promise.all([
          student.browser.request('/orders', 'POST', bodyFor(value), randomUUID()),
          action === 'pause'
            ? staff.browser.request('/canteens/' + canteen.id + '/availability', 'PATCH', { expectedVersion: can.version, acceptingOrders: false })
            : staff.browser.request('/menu-items/' + item.id, 'PATCH', { expectedVersion: menu.version, pricePaise: menu.pricePaise + 1 }),
        ]);
        assert.equal(update.status, 200); assert([201, 409].includes(checkout.status));
        assert.equal(await db.order.count(), before + (checkout.status === 201 ? 1 : 0));
        if (checkout.status === 201) {
          assert.equal(checkout.body.totalPaise, value.totalPaise); assert.equal((await cart()).items.length, 0);
          assert.equal((await staff.browser.request('/orders/' + checkout.body.id)).status, 200);
        } else assert.equal((await cart()).items.length, 1);
        if (action === 'pause') {
          const paused = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
          await staff.browser.request('/canteens/' + canteen.id + '/availability', 'PATCH', { expectedVersion: paused.version, acceptingOrders: true });
        }
        const remaining = await cart();
        if (remaining.items.length) await student.browser.request('/cart', 'DELETE', { expectedVersion: remaining.version });
      }
    });
    await t.test('outbox failure rolls back order, allocation, snapshots, cart clearing and idempotency claim', async () => {
      const value = await fill(); const body = bodyFor(value); const key = randomUUID();
      const before = { orders: await db.order.count(), codes: await db.orderCodeAllocation.count(), items: await db.orderItem.count(), events: await db.orderEvent.count() };
      await db.$executeRawUnsafe("CREATE FUNCTION test_outbox_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$");
      await db.$executeRawUnsafe('CREATE TRIGGER test_outbox_failure BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION test_outbox_failure()');
      try { assert.equal((await student.browser.request('/orders', 'POST', body, key)).status, 500); }
      finally { await db.$executeRawUnsafe('DROP TRIGGER test_outbox_failure ON outbox_events'); await db.$executeRawUnsafe('DROP FUNCTION test_outbox_failure()'); }
      assert.deepEqual({ orders: await db.order.count(), codes: await db.orderCodeAllocation.count(), items: await db.orderItem.count(), events: await db.orderEvent.count() }, before);
      assert.equal(await db.idempotencyKey.count({ where: { key } }), 0); assert.equal((await cart()).version, value.version);
      assert.equal((await student.browser.request('/orders', 'POST', body, key)).status, 201);
    });
    await t.test('only owning active staff can advance orders and no state may be skipped', async () => {
      assert.equal((await student.browser.request('/orders/' + first.id + '/accept', 'POST', { expectedVersion: 1 }, randomUUID())).status, 403);
      assert.equal((await otherStaff.browser.request('/orders/' + first.id + '/accept', 'POST', { expectedVersion: 1 }, randomUUID())).status, 404);
      assert.equal((await staff.browser.request('/orders/' + first.id + '/prepare', 'POST', { expectedVersion: 1 }, randomUUID())).body.error.code, 'ORDER_STATE_CONFLICT');
      assert.equal((await staff.browser.request('/orders/' + first.id + '/ready', 'POST', { expectedVersion: 1 }, randomUUID())).status, 409);
      assert.equal((await staff.browser.request('/orders/' + first.id + '/accept', 'POST', { expectedVersion: 1 })).status, 422);
    });
    await t.test('a fulfillment outbox failure rolls back status, history and the command claim', async () => {
      const key = randomUUID();
      await db.$executeRawUnsafe("CREATE FUNCTION test_transition_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$");
      await db.$executeRawUnsafe('CREATE TRIGGER test_transition_failure BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION test_transition_failure()');
      try { assert.equal((await staff.browser.request('/orders/' + first.id + '/accept', 'POST', { expectedVersion: 1 }, key)).status, 500); }
      finally { await db.$executeRawUnsafe('DROP TRIGGER test_transition_failure ON outbox_events'); await db.$executeRawUnsafe('DROP FUNCTION test_transition_failure()'); }
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: first.id } })).status, 'RECEIVED');
      assert.equal(await db.orderEvent.count({ where: { orderId: first.id } }), 1);
      assert.equal(await db.idempotencyKey.count({ where: { key } }), 0);
    });
    await t.test('two staff cannot double-advance and a command replay returns the original response exactly once', async () => {
      const key = randomUUID(); const version = { expectedVersion: 1 };
      const [a, b] = await Promise.all([staff.browser.request('/orders/' + first.id + '/accept', 'POST', version, key), staffTwo.browser.request('/orders/' + first.id + '/accept', 'POST', version, randomUUID())]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
      const winning = a.status === 200 ? staff.browser : staffTwo.browser;
      const accepted = a.status === 200 ? a.body : b.body;
      if (a.status === 200) assert.deepEqual((await staff.browser.request('/orders/' + first.id + '/accept', 'POST', version, key)).body, accepted);
      assert.equal((await winning.request('/orders/' + first.id + '/accept', 'POST', { expectedVersion: 2 }, randomUUID())).status, 409);
      assert.equal(await db.orderEvent.count({ where: { orderId: first.id, newStatus: 'ACCEPTED' } }), 1);
      const prepared = await winning.request('/orders/' + first.id + '/prepare', 'POST', { expectedVersion: 2 }, randomUUID()); assert.equal(prepared.status, 200); assert.equal(prepared.body.status, 'PREPARING');
      if (a.status === 200) assert.equal((await staff.browser.request('/orders/' + first.id + '/accept', 'POST', version, key)).body.status, 'ACCEPTED');
    });
    await t.test('paused canteens and late pickup still permit fulfillment; each change records one timestamped outbox event', async () => {
      const current = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      await staff.browser.request('/canteens/' + canteen.id + '/availability', 'PATCH', { expectedVersion: current.version, acceptingOrders: false });
      now = new Date(now.getTime() + 2 * 3600000);
      const key = randomUUID(); const body = { expectedVersion: 3 };
      const ready = await staff.browser.request('/orders/' + first.id + '/ready', 'POST', body, key);
      assert.equal(ready.status, 200); assert.equal(ready.body.status, 'READY');
      assert.deepEqual(ready.body.events.map((event: { newStatus: string }) => event.newStatus), ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY']);
      assert.equal(ready.body.events.at(-1).createdAt, now.toISOString()); assert.equal(ready.body.events.at(-1).actorId, staff.user.id);
      assert.deepEqual((await staff.browser.request('/orders/' + first.id + '/ready', 'POST', body, key)).body, ready.body);
      assert.equal(await db.outboxEvent.count({ where: { event: { orderId: first.id } } }), 4);
      assert.equal((await staff.browser.request('/orders/' + first.id + '/ready', 'POST', { expectedVersion: 4 }, randomUUID())).status, 409);
      assert.equal((await staff.browser.request('/orders/' + first.id + '/collect', 'POST', { expectedVersion: 4, code: first.orderCode }, randomUUID())).status, 404);
      const c = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      await staff.browser.request('/canteens/' + canteen.id + '/availability', 'PATCH', { expectedVersion: c.version, acceptingOrders: true });
    });
    await t.test('campus midnight permits next-day code reuse while lost-response retries keep their original day', async () => {
      now = new Date('2026-11-01T18:29:50.000Z');
      const body = bodyFor(await fill()); const key = randomUUID();
      const before = await student.browser.request('/orders', 'POST', body, key); assert.equal(before.status, 201); assert.equal(before.body.codeDay, '2026-11-01');
      now = new Date('2026-11-01T18:30:01.000Z');
      const replay = await student.browser.request('/orders', 'POST', body, key); assert.deepEqual(replay.body, before.body);
      const next = await student.browser.request('/orders', 'POST', bodyFor(await fill()), randomUUID());
      assert.equal(next.status, 201); assert.equal(next.body.codeDay, '2026-11-02'); assert.equal(next.body.orderCode, '000');
      assert.equal((await student.browser.request('/orders/' + first.id)).body.status, 'READY');
    });
    await t.test('a full daily namespace fails cleanly, retaining the cart and immutable prior allocations', async () => {
      now = new Date('2026-11-03T10:00:00.000Z');
      await db.$executeRaw`
        WITH created AS (
          INSERT INTO orders (id,student_id,canteen_id,total_paise,pickup_at,code_day,order_code,created_at,updated_at)
          SELECT gen_random_uuid(), ${second.user.id}::uuid, ${other.id}::uuid, 0, ${now}, '2026-11-03'::date,
            substring('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', (n / 1296) + 1, 1) ||
            substring('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', ((n / 36) % 36) + 1, 1) ||
            substring('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', (n % 36) + 1, 1), ${now}, ${now}
          FROM generate_series(0,46655) AS n RETURNING id,code_day,order_code
        ) INSERT INTO order_code_allocations (order_id,code_day,code) SELECT id,code_day,order_code FROM created`;
      const value = await fill(); const key = randomUUID();
      const result = await student.browser.request('/orders', 'POST', bodyFor(value), key);
      assert.equal(result.status, 409); assert.equal(result.body.error.code, 'ORDER_CODE_CAPACITY_EXHAUSTED');
      assert.equal((await cart()).version, value.version); assert.equal(await db.idempotencyKey.count({ where: { key } }), 0);
      assert.equal(await db.orderCodeAllocation.count({ where: { codeDay: new Date('2026-11-03') } }), 46656);
    });
    await t.test('revoked staff sessions cannot advance even an otherwise valid order', async () => {
      await db.session.update({ where: { id: staff.session.id }, data: { revokedAt: new Date() } });
      assert.equal((await staff.browser.request('/orders/' + first.id + '/ready', 'POST', { expectedVersion: 4 }, randomUUID())).status, 401);
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
});
