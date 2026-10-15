import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderActions, mapOrder } from '../src/services/orderActions.js';
function fixture() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  return { values, storage };
}
test('uncertain checkout persists its exact body and key across retries, refreshes and changed UI input', async () => {
  const { storage, values } = fixture(); const calls = []; let fail = true;
  const api = async (path, options) => { calls.push({ path, ...options }); if (fail) throw new Error('lost response'); return { id: 'order', status: 'RECEIVED' }; };
  const actions = createOrderActions({ api, storage, actorId: 'student', uuid: () => 'first-stable-key' });
  const body = { expectedVersion: 2, quote: 'first-quote', pickupAt: '2026-11-01T10:20:00Z' };
  await assert.rejects(actions.checkout(body), /lost response/);
  assert.deepEqual(actions.pendingCheckout().body, body);
  const refreshed = createOrderActions({ api, storage, actorId: 'student', uuid: () => 'different-key' });
  fail = false;
  assert.equal((await refreshed.checkout({ expectedVersion: 9, quote: 'new-quote', pickupAt: 'later' })).id, 'order');
  assert.deepEqual(calls[0].body, calls[1].body); assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey);
  assert.equal(values.size, 0); assert.equal(refreshed.pendingCheckout(), null);
});
test('definitive cart/quote conflicts release the request so the student can review a new checkout', async () => {
  const { storage } = fixture(); let counter = 0; const keys = [];
  const api = async (_path, options) => { keys.push(options.idempotencyKey); if (keys.length === 1) throw Object.assign(new Error('Cart changed'), { status: 409 }); return { id: 'new-order', status: 'RECEIVED' }; };
  const actions = createOrderActions({ api, storage, actorId: 'student', uuid: () => 'key-' + ++counter });
  await assert.rejects(actions.checkout({ expectedVersion: 1 }), /Cart changed/); assert.equal(actions.pendingCheckout(), null);
  await actions.checkout({ expectedVersion: 2 }); assert.notEqual(keys[0], keys[1]);
});
test('unconfirmed success responses and server errors keep the safe retry mapping', async () => {
  const { storage } = fixture();
  const actions = createOrderActions({ api: async () => null, storage, actorId: 'student', uuid: () => 'key' });
  await assert.rejects(actions.checkout({ expectedVersion: 1 }), /not be confirmed/); assert(actions.pendingCheckout());
});
test('staff commands reuse their original expected version and key after an uncertain failure', async () => {
  const { storage } = fixture(); const calls = [];
  const actions = createOrderActions({ storage, actorId: 'staff', uuid: () => 'command-key', api: async (path, options) => {
    calls.push({ path, ...options }); if (calls.length === 1) throw new Error('offline'); return { id: 'order', status: 'ACCEPTED' };
  } });
  await assert.rejects(actions.transition({ id: 'order', version: 1 }, 'ACCEPTED'));
  await actions.transition({ id: 'order', version: 2 }, 'ACCEPTED');
  assert.equal(calls[1].path, '/orders/order/accept'); assert.deepEqual(calls[0].body, calls[1].body); assert.equal(calls[1].body.expectedVersion, 1);
  assert.throws(() => actions.transition({ id: 'order', version: 3 }, 'COLLECTED'), /not available/);
});
test('pending checkout requests are isolated by authenticated actor', async () => {
  const { storage } = fixture();
  const a = createOrderActions({ api: async () => { throw new Error('offline'); }, storage, actorId: 'one', uuid: () => 'key' });
  await assert.rejects(a.checkout({ expectedVersion: 1 }));
  const b = createOrderActions({ api: async () => {}, storage, actorId: 'two' });
  assert.equal(b.pendingCheckout(), null);
});
test('server orders retain their UUID, code/day, immutable paise prices and status history', () => {
  const order = mapOrder({ id: 'uuid', orderCode: 'A01', codeDay: '2026-11-01', canteenId: 'can', canteenName: 'Bella Bite', totalPaise: 6050,
    items: [{ id: 'line', unitPricePaise: 6050, quantity: 1 }], events: [{ newStatus: 'READY', createdAt: '2026-11-01T10:00:00Z' }] }, [{ databaseId: 'can', id: 'bella-bite' }]);
  assert.equal(order.id, 'uuid'); assert.equal(order.orderCode, 'A01'); assert.equal(order.total, 60.5); assert.equal(order.cafeId, 'bella-bite');
  assert.deepEqual(order.history, [{ status: 'READY', at: '2026-11-01T10:00:00Z' }]);
});
test('CSRF recovery preserves the idempotency key and original request body', async t => {
  const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
  const calls = []; let posts = 0; let csrf = 0;
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    if (path.endsWith('/csrf')) return Response.json({ csrfToken: 'csrf-' + ++csrf });
    if (++posts === 1) return Response.json({ error: { code: 'CSRF_INVALID', message: 'Refresh' } }, { status: 403 });
    return Response.json({ id: 'uuid', status: 'RECEIVED' }, { status: 201 });
  };
  const { api } = await import('../src/services/api.js?orders-csrf-test');
  await api('/orders', { method: 'POST', body: { expectedVersion: 1 }, idempotencyKey: 'stable-checkout-key' });
  const writes = calls.filter(call => call.options.method === 'POST');
  assert.equal(writes.length, 2); assert.equal(writes[0].options.headers['Idempotency-Key'], writes[1].options.headers['Idempotency-Key']);
  assert.equal(writes[0].options.body, writes[1].options.body); assert.notEqual(writes[0].options.headers['X-CSRF-Token'], writes[1].options.headers['X-CSRF-Token']);
});
