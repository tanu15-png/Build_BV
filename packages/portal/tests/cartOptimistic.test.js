import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createCartQueue } from '../src/services/cartQueue.js';
import { addCartItem, changeCartQuantity } from '../src/services/cartChanges.js';

const initial = { id: 'cart', version: 1, canteenId: null, items: [], totalPaise: 0, available: false, quote: 'confirmed-1' };
const canteen = { id: 'canteen', operational: true, acceptingOrders: true };
const food = { id: 'noodles', canteenId: canteen.id, name: 'Noodles', pricePaise: 6050, categoryId: 'snacks', category: 'Snacks',
  description: 'Fresh noodles', imageRef: 'https://example.edu/noodles.jpg', version: 1, available: true, archived: false };
const add = () => ({ path: '/cart/items', method: 'POST', values: { menuItemId: food.id, quantity: 1 } });
const project = cart => addCartItem(cart, food, canteen);
const saved = (quantity, version) => ({ ...project(initial), version, quote: `confirmed-${version}`,
  items: [{ ...project(initial).items[0], id: 'server-line', quantity }], totalPaise: quantity * food.pricePaise });
function setup() {
  const requests = []; const errors = []; let state;
  const queue = createCartQueue({
    request: (path, options) => new Promise((resolve, reject) => requests.push({ path, ...options, resolve, reject })),
    changed: snapshot => { state = snapshot; }, failed: error => errors.push(error),
  });
  return { queue, requests, errors, state: () => state };
}

test('items, counts and totals update before any response, and confirmations preserve pending clicks', async () => {
  const { queue, requests, state } = setup();
  const first = queue.enqueue(add, project); const second = queue.enqueue(add, project);
  assert.equal(requests.length, 1); assert.equal(requests[0].path, '/cart');
  assert.equal(state().cart.items[0].name, 'Noodles');
  assert.equal(state().cart.items[0].quantity, 2); assert.equal(state().cart.totalPaise, 12100);
  assert.equal(state().pending, 2); assert.equal(state().cart.quote, '');
  requests[0].resolve(initial); await setImmediate();
  assert.equal(state().cart.items[0].quantity, 2);
  assert.equal(requests[1].body.expectedVersion, 1);
  requests[1].resolve(saved(1, 2)); await first; await setImmediate();
  assert.equal(state().cart.items[0].quantity, 2); assert.equal(state().pending, 1);
  assert.equal(requests[2].body.expectedVersion, 2); assert.equal(requests[2].body.quantity, 1);
  requests[2].resolve(saved(2, 3)); await second;
  assert.equal(state().cart.items[0].quantity, 2); assert.equal(state().pending, 0);
  assert.equal(state().cart.quote, 'confirmed-3');
});

test('queued quantity changes and removal are instant and use real line IDs only when saving', async () => {
  const { queue, requests, state } = setup();
  const first = queue.enqueue(add, project);
  const quantity = queue.enqueue(cart => ({ path: `/cart/items/${cart.items[0].id}`, method: 'PATCH', values: { quantity: 2 } }),
    cart => changeCartQuantity(cart, food.id, 2));
  assert.equal(state().cart.items[0].quantity, 2);
  const removal = queue.enqueue(cart => ({ path: `/cart/items/${cart.items[0].id}`, method: 'DELETE' }),
    cart => changeCartQuantity(cart, food.id, 0));
  assert.equal(state().cart.items.length, 0); assert.equal(state().cart.totalPaise, 0);
  requests[0].resolve(initial); await setImmediate();
  requests[1].resolve(saved(1, 2)); await first; await setImmediate();
  assert.equal(requests[2].path, '/cart/items/server-line'); assert.equal(state().cart.items.length, 0);
  requests[2].resolve(saved(2, 3)); await quantity; await setImmediate();
  assert.equal(requests[3].path, '/cart/items/server-line'); assert.equal(requests[3].method, 'DELETE');
  requests[3].resolve({ ...initial, version: 4 }); await removal;
  assert.equal(state().pending, 0); assert.equal(state().cart.items.length, 0);
});

test('a late initial read rebases additions onto the existing saved quantities', async () => {
  const { queue, requests, state } = setup();
  const first = queue.enqueue(add, project);
  assert.equal(state().cart.items[0].quantity, 1);
  requests[0].resolve(saved(3, 4)); await setImmediate();
  assert.equal(state().cart.items[0].quantity, 4);
  assert.equal(requests[1].body.expectedVersion, 4);
  requests[1].resolve(saved(4, 5)); await first;
  assert.equal(state().cart.items[0].quantity, 4);
});

test('an uncertain save rolls back pending quantities and keeps the last confirmed cart visible', async () => {
  const { queue, requests, state } = setup();
  const load = queue.load(); requests[0].resolve(saved(1, 2)); await load;
  const first = queue.enqueue(add, project); const second = queue.enqueue(add, project);
  assert.equal(state().cart.items[0].quantity, 3);
  await setImmediate();
  requests[1].reject(Object.assign(new Error('Connection lost'), { status: 503, code: 'NETWORK_ERROR' }));
  await assert.rejects(first, /Connection lost/); await assert.rejects(second, /earlier cart update failed/);
  assert.equal(state().cart.items[0].quantity, 1); assert.equal(state().pending, 0);
  const retry = queue.enqueue(add, project);
  assert.equal(requests[2].path, '/cart');
  requests[2].resolve(saved(2, 3)); await setImmediate();
  assert.equal(state().cart.items[0].quantity, 3);
  requests[3].resolve(saved(3, 4)); await retry;
  assert.equal(requests.length, 4, 'the uncertain addition must not be automatically replayed');
});

test('discovering another canteen in the saved cart rejects pending additions without writing', async () => {
  const { queue, requests, state } = setup();
  const first = queue.enqueue(add, project);
  const other = { ...saved(1, 2), canteenId: 'other', items: [{ ...saved(1, 2).items[0], canteenId: 'other' }] };
  requests[0].resolve(other);
  await assert.rejects(first, /another canteen/);
  assert.equal(requests.length, 1); assert.equal(state().cart.canteenId, 'other'); assert.equal(state().pending, 0);
});

test('optimistic changes keep the confirmed cart immutable and enforce availability and quantity limits', () => {
  const cart = saved(1, 2); const before = JSON.stringify(cart);
  assert.equal(addCartItem(cart, food, canteen).items[0].quantity, 2);
  assert.equal(changeCartQuantity(cart, food.id, 2).totalPaise, 12100);
  assert.equal(JSON.stringify(cart), before);
  assert.throws(() => addCartItem(saved(99, 2), food, canteen), /at most 99/);
  assert.throws(() => addCartItem(cart, { ...food, available: false }, canteen), /unavailable/);
  assert.throws(() => changeCartQuantity(cart, food.id, 100), /0 to 99/);
});
