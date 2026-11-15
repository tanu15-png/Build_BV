import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed } from '../../src/services/provision.js';
import { createPayments, reconcilePaymentBatch } from '../../src/services/payments.js';
import { notificationData } from '../../src/services/outbox.js';
import { orderSchema } from '../../src/schemas/contracts.js';

const url = process.env.PAYMENT_TEST_DATABASE_URL;
test('accept first, Razorpay test payment, verified fulfilment, expiry and no refunds', { skip: !url }, async t => {
  assert(url); const address = new URL(url);
  assert(['localhost', '127.0.0.1'].includes(address.hostname) && address.pathname.includes('test')); assert.notEqual(url, process.env.DATABASE_URL);
  const migrated = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url }, encoding: 'utf8', timeout: 180000 }); assert.equal(migrated.status, 0, migrated.stderr);
  const config = loadConfig({ DATABASE_URL: url, FRONTEND_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test', APP_ENV: 'test', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SEED_DEVELOPMENT_DATA: 'true', DB_TIMEOUT_MS: '10000', LOG_LEVEL: 'silent', ORDER_MODE: 'RAZORPAY_TEST', RAZORPAY_KEY_ID: 'rzp_test_fixture123', RAZORPAY_KEY_SECRET: 'fixture-secret-not-a-real-key-123456', RAZORPAY_WEBHOOK_SECRET: 'fixture-webhook-secret-not-real-123456' });
  const db = createPrisma(config); await seed(db, config);
  const canteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'canteen' } });
  const item = await db.menuItem.findFirstOrThrow({ where: { canteenId: canteen.id } }); await db.menuItem.update({ where: { id: item.id }, data: { pricePaise: 10000 } });
  type GatewayOrder = { id: string; receipt: string; amount: number; currency: string; status: string };
  type Payment = { id: string; order_id: string; amount: number; currency: string; status: string; captured: boolean; amount_refunded: number };
  const gatewayOrders = new Map<string, GatewayOrder>(), gatewayPayments = new Map<string, Payment>(), calls: string[] = [];
  let lostCreate = false, failDiscovery = false;
  const gateway = (async (input: string | URL | Request, options?: RequestInit) => {
    const target = new URL(String(input)), path = target.pathname.slice(4), method = options?.method || 'GET'; calls.push(`${method} ${path}`);
    assert(!path.includes('refund'), 'The app must never request a refund');
    assert.equal(target.origin, 'https://api.razorpay.com');
    const auth = new Headers(options?.headers).get('authorization'); assert.equal(auth, 'Basic ' + Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64'));
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    if (path === 'orders' && method === 'POST') {
      const body = JSON.parse(String(options?.body));
      if ([...gatewayOrders.values()].some(row => row.receipt === body.receipt)) return json({}, 400);
      const value = { ...body, id: 'order_' + (gatewayOrders.size + 1), status: 'created' }; gatewayOrders.set(value.id, value);
      if (lostCreate) { lostCreate = false; throw new Error('Simulated lost create response'); }
      return json(value);
    }
    if (path === 'orders') {
      if (failDiscovery) { failDiscovery = false; throw new Error('Simulated checkout setup outage'); }
      return json({ items: [...gatewayOrders.values()].filter(row => row.receipt === target.searchParams.get('receipt')) });
    }
    const orderPayments = path.match(/^orders\/(order_[A-Za-z0-9]+)\/payments$/);
    if (orderPayments) return json({ items: [...gatewayPayments.values()].filter(row => row.order_id === orderPayments[1]) });
    const payment = path.match(/^payments\/(pay_[A-Za-z0-9]+)(\/capture)?$/);
    if (payment) {
      const value = gatewayPayments.get(payment[1]!); assert(value);
      if (payment[2]) { assert.equal(method, 'POST'); assert.equal(JSON.parse(String(options?.body)).amount, value.amount); value.status = 'captured'; value.captured = true; }
      return json(value);
    }
    assert.fail('Unexpected payment API path: ' + path);
  }) as typeof fetch;
  const app = createApp(config, db, () => {}, fetch, { paymentFetch: gateway });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const socket = server.address(); assert(socket && typeof socket !== 'string'); const origin = `http://127.0.0.1:${socket.port}`;
  class Browser {
    jar = new Map<string, string>(); csrf = ''; constructor(readonly portal = 'student') {}
    async request(path: string, method = 'GET', body?: object) {
      const response = await fetch(`${origin}/api/v1/${this.portal}${path}`, { method, headers: { Origin: this.portal === 'student' ? config.FRONTEND_ORIGIN : config.CANTEEN_ORIGIN, Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf, 'Idempotency-Key': randomUUID() }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0]!.split('='); this.jar.set(name!, value!); }
      return { status: response.status, body: await response.json() };
    }
    async prepare() { this.csrf = (await this.request('/auth/csrf')).body.csrfToken; return this; }
  }
  const staff = await new Browser('canteen').prepare(); assert.equal((await staff.request('/auth/canteen/access', 'POST', { name: 'Payments Owner', accessCode: 'shanu' })).status, 200);
  async function studentFixture() {
    const user = await db.user.create({ data: { name: 'Payment Student', email: randomUUID() + '@banasthali.in', supabaseSubject: randomUUID(), roles: { create: { role: 'STUDENT' } } } });
    const token = randomBytes(32).toString('hex'); await db.session.create({ data: { userId: user.id, role: 'STUDENT', tokenHash: createHmac('sha256', config.SESSION_SECRET).update(`session:${token}`).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    const browser = await new Browser().prepare(); browser.jar.set('spoonate_student_session', token); return { browser, user };
  }
  const { browser: student, user } = await studentFixture(), { browser: other } = await studentFixture();
  async function newOrder() {
    await db.rateLimit.deleteMany({ where: { key: { startsWith: 'payment:' } } });
    const cart = await student.request('/cart');
    const added = await student.request('/cart/items', 'POST', { menuItemId: item.id, quantity: 1, expectedVersion: cart.body.version }); assert.equal(added.status, 200);
    const result = await student.request('/orders', 'POST', { expectedVersion: added.body.version, quote: added.body.quote }); assert.equal(result.status, 201); return orderSchema.parse(result.body);
  }
  async function advance(id: string, action: string) {
    const latest = await student.request('/orders/' + id);
    return staff.request(`/orders/${id}/${action}`, 'POST', { expectedVersion: latest.body.version });
  }
  async function checkout(id: string) { const result = await student.request(`/orders/${id}/payment/checkout`, 'POST', {}); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
  function payment(orderId: string, status = 'captured') {
    const order = gatewayOrders.get(orderId)!; const value = { id: 'pay_' + (gatewayPayments.size + 1), order_id: orderId, amount: order.amount, currency: 'INR', status, captured: status === 'captured', amount_refunded: 0 }; gatewayPayments.set(value.id, value); return value;
  }
  async function webhook(value: Payment, valid = true) {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: value } } }, null, 2);
    return fetch(origin + '/api/payments/razorpay/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': valid ? createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET!).update(body).digest('hex') : '0'.repeat(64) }, body });
  }
  try {
    await t.test('acceptance gates payment; ownership and payment gate preparation; paid orders are final', async () => {
      const order = await newOrder(); assert.equal(order.executionMode, 'RAZORPAY_TEST'); assert.equal(order.paymentStatus, 'AWAITING_ACCEPTANCE');
      assert.equal((await student.request(`/orders/${order.id}/payment/checkout`, 'POST', {})).status, 409); assert.equal(gatewayOrders.size, 0);
      assert.equal((await advance(order.id, 'accept')).status, 200);
      assert.equal((await advance(order.id, 'prepare')).body.error.code, 'PAYMENT_REQUIRED');
      assert.equal((await other.request(`/orders/${order.id}/payment/checkout`, 'POST', {})).status, 404);
      const ready = await checkout(order.id); assert.equal(ready.amountPaise, 10000);
      const retried = await checkout(order.id); assert.equal(retried.razorpayOrderId, ready.razorpayOrderId); assert.equal(gatewayOrders.size, 1);
      const paid = payment(ready.razorpayOrderId);
      assert.equal((await webhook(paid, false)).status, 400);
      assert.equal((await student.request(`/orders/${order.id}/payment/verify`, 'POST', { razorpay_order_id: ready.razorpayOrderId, razorpay_payment_id: paid.id, razorpay_signature: '0'.repeat(64) })).status, 400);
      const signature = createHmac('sha256', config.RAZORPAY_KEY_SECRET!).update(`${ready.razorpayOrderId}|${paid.id}`).digest('hex');
      assert.equal((await student.request(`/orders/${order.id}/payment/verify`, 'POST', { razorpay_order_id: ready.razorpayOrderId, razorpay_payment_id: paid.id, razorpay_signature: signature })).body.paymentStatus, 'PAID');
      assert.equal((await webhook(paid)).status, 200); assert.equal((await webhook(paid)).status, 200);
      assert.equal(await db.orderEvent.count({ where: { orderId: order.id, previousStatus: 'ACCEPTED', newStatus: 'ACCEPTED' } }), 1);
      assert.equal((await student.request(`/orders/${order.id}/payment/cancel`, 'POST', {})).body.error.code, 'PAID_ORDER_FINAL');
      assert.equal((await advance(order.id, 'reject')).status, 409);
      assert.equal((await student.request('/rewards')).body.earned, 0);
      for (const action of ['prepare', 'ready', 'collect']) assert.equal((await advance(order.id, action)).status, 200);
      assert.equal((await student.request('/rewards')).body.earned, 10);
    });
    await t.test('authorized payments are captured once; failed attempts reuse the same order', async () => {
      const order = await newOrder(); await advance(order.id, 'accept'); const ready = await checkout(order.id);
      payment(ready.razorpayOrderId, 'failed'); const retry = await checkout(order.id); assert.equal(retry.razorpayOrderId, ready.razorpayOrderId);
      const authorized = payment(ready.razorpayOrderId, 'authorized');
      assert.equal((await student.request(`/orders/${order.id}/payment/check`, 'POST', {})).body.paymentStatus, 'PAID');
      assert.equal((await student.request(`/orders/${order.id}/payment/check`, 'POST', {})).body.paymentStatus, 'PAID');
      assert.equal(calls.filter(call => call === `POST payments/${authorized.id}/capture`).length, 1);
    });
    await t.test('lost create response is recovered by receipt without a second gateway order', async () => {
      const order = await newOrder(); await advance(order.id, 'accept'); const before = gatewayOrders.size; lostCreate = true;
      assert.equal((await student.request(`/orders/${order.id}/payment/checkout`, 'POST', {})).status, 503);
      assert.equal((await student.request(`/orders/${order.id}/payment/cancel`, 'POST', {})).body.error.code, 'PAYMENT_STARTED');
      await student.request(`/orders/${order.id}/payment/check`, 'POST', {}); await checkout(order.id); assert.equal(gatewayOrders.size, before + 1);
    });
    await t.test('setup failure can retry after its lease; pending bank payments cannot reopen checkout', async () => {
      const order = await newOrder(); await advance(order.id, 'accept'); const before = gatewayOrders.size; failDiscovery = true;
      assert.equal((await student.request(`/orders/${order.id}/payment/checkout`, 'POST', {})).status, 503);
      assert.equal((await student.request(`/orders/${order.id}/payment/checkout`, 'POST', {})).body.error.code, 'PAYMENT_PROCESSING');
      await db.order.update({ where: { id: order.id }, data: { paymentLeaseUntil: new Date(0) } });
      assert.equal((await student.request(`/orders/${order.id}/payment/check`, 'POST', {})).body.paymentStatus, 'AWAITING_PAYMENT');
      const ready = await checkout(order.id); assert.equal(gatewayOrders.size, before + 1);
      const pending = payment(ready.razorpayOrderId, 'created');
      assert.equal((await student.request(`/orders/${order.id}/payment/check`, 'POST', {})).body.paymentStatus, 'PROCESSING');
      assert.equal((await student.request(`/orders/${order.id}/payment/checkout`, 'POST', {})).body.error.code, 'PAYMENT_PROCESSING');
      assert.equal(gatewayOrders.size, before + 1);
      pending.status = 'failed';
      assert.equal((await checkout(order.id)).razorpayOrderId, ready.razorpayOrderId);
    });
    await t.test('unpaid orders can be cancelled before checkout; accepted unpaid orders expire', async () => {
      const cancelled = await newOrder(); assert.equal((await student.request(`/orders/${cancelled.id}/payment/cancel`, 'POST', {})).body.closedReason, 'STUDENT_CANCELLED');
      const order = await newOrder(); await advance(order.id, 'accept'); await db.order.update({ where: { id: order.id }, data: { paymentDeadline: new Date(0) } });
      await reconcilePaymentBatch(config, db, () => false, gateway);
      assert.equal((await student.request('/orders/' + order.id)).body.closedReason, 'PAYMENT_EXPIRED');
      assert.equal((await advance(order.id, 'prepare')).status, 409);
    });
    await t.test('pending payments and gateway outages cannot keep expired orders active', async () => {
      const order = await newOrder(); await advance(order.id, 'accept'); const ready = await checkout(order.id);
      const pending = payment(ready.razorpayOrderId, 'created');
      await db.order.update({ where: { id: order.id }, data: { paymentDeadline: new Date(0), paymentNextCheckAt: new Date(0) } });
      await reconcilePaymentBatch(config, db, () => false, gateway);
      const expired = (await student.request('/orders/' + order.id)).body;
      assert.equal(expired.status, 'REJECTED'); assert.equal(expired.closedReason, 'PAYMENT_EXPIRED');
      pending.status = 'captured'; pending.captured = true;
      assert.equal((await webhook(pending)).status, 200);
      assert.equal((await student.request('/orders/' + order.id)).body.paymentStatus, 'PAID');
      const interrupted = await newOrder(); await advance(interrupted.id, 'accept');
      await db.order.update({ where: { id: interrupted.id }, data: { paymentDeadline: new Date(0), paymentKeyId: config.RAZORPAY_KEY_ID, paymentStatus: 'PROCESSING' } });
      failDiscovery = true;
      await reconcilePaymentBatch(config, db, () => false, gateway);
      assert.equal((await student.request('/orders/' + interrupted.id)).body.closedReason, 'PAYMENT_EXPIRED');
    });
    await t.test('expiry works without worker payment credentials and scoped reads repair old active orders once', async () => {
      const order = await newOrder(); await advance(order.id, 'accept');
      await db.order.update({ where: { id: order.id }, data: { paymentDeadline: new Date(0) } });
      await reconcilePaymentBatch({ ...config, RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined }, db, () => false, gateway);
      assert.equal((await student.request('/orders/' + order.id)).body.closedReason, 'PAYMENT_EXPIRED');
      const stale = await newOrder(); await advance(stale.id, 'accept');
      await db.order.update({ where: { id: stale.id }, data: { paymentDeadline: new Date(0), paymentStatus: 'PROCESSING' } });
      await other.request('/orders');
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: stale.id } })).status, 'ACCEPTED');
      await student.request('/orders'); await student.request('/orders');
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: stale.id } })).closedReason, 'PAYMENT_EXPIRED');
      const events = await db.orderEvent.findMany({ where: { orderId: stale.id, newStatus: 'REJECTED' }, include: { order: { include: { canteen: true } } } });
      assert.equal(events.length, 1);
      assert.match(notificationData(events[0]!)!.message, /removed from active orders/);
    });
    await t.test('late capture reactivates an expired order; wrong amounts never unlock preparation', async () => {
      const order = await newOrder(); await advance(order.id, 'accept'); const ready = await checkout(order.id);
      await db.order.update({ where: { id: order.id }, data: { paymentDeadline: new Date(0) } });
      assert.equal((await student.request(`/orders/${order.id}/payment/check`, 'POST', {})).body.paymentStatus, 'PAYMENT_EXPIRED');
      const paid = payment(ready.razorpayOrderId); paid.amount = 5000; assert.equal((await webhook(paid)).status, 409);
      assert.equal((await advance(order.id, 'prepare')).status, 409);
      paid.amount = 10000; assert.equal((await webhook(paid)).status, 200);
      const restored = await student.request('/orders/' + order.id); assert.equal(restored.body.status, 'ACCEPTED'); assert.equal(restored.body.paymentStatus, 'PAID');
      const anotherAccount = createPayments({ ...config, RAZORPAY_KEY_ID: 'rzp_test_otheraccount' }, db, gateway);
      await assert.rejects(() => anotherAccount.checkout(order.id, user.id), { code: 'PAYMENT_ACCOUNT_CHANGED' });
    });
    await t.test('token-only reward orders bypass payment; database rejects unpaid preparation', async () => {
      const order = await newOrder(); await advance(order.id, 'accept');
      await assert.rejects(() => db.order.update({ where: { id: order.id }, data: { status: 'PREPARING' } }));
      await db.reward.create({ data: { canteenId: canteen.id, menuItemId: item.id, tokenCost: 1 } });
      const reward = (await student.request('/rewards')).body.rewards[0];
      const redeemed = await student.request('/rewards/redeem', 'POST', { rewardId: reward.id, expectedTokenCost: 1 }); assert.equal(redeemed.status, 201);
      assert.equal(redeemed.body.executionMode, 'REWARD');
      for (const action of ['accept', 'prepare', 'ready', 'collect']) assert.equal((await advance(redeemed.body.id, action)).status, 200);
      assert.equal(calls.some(call => call.includes('refund')), false);
    });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
});
