import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { checkoutSnapshot, submitCheckout } from '../src/services/checkout.js';
import { createCartQueue } from '../src/services/cartQueue.js';
import { addCartItem } from '../src/services/cartChanges.js';
const cart = { id: 'cart', canteenId: 'canteen', version: 1, totalPaise: 1000, available: true,
  quote: 'original-token', quoteExpiresAt: 'old-expiry',
  items: [{ id: 'line', menuItemId: 'tea', name: 'Tea', quantity: 1, unitPricePaise: 1000, available: true }] };
test('refreshing the verification token does not change the reviewed cart', async () => {
  const fresh = { ...cart, quote: 'new-token', quoteExpiresAt: 'new-expiry' };
  assert.equal(checkoutSnapshot(cart), checkoutSnapshot(fresh));
  const order = await submitCheckout({ cart, review: async () => fresh,
    createOrder: async body => {
      assert.deepEqual(body, { expectedVersion: 1, quote: 'new-token' });
      return { id: 'order' };
    } });
  assert.equal(order.id, 'order');
});
test('actual price, quantity, item, or canteen changes require reviewing the displayed cart again', async () => {
  for (const fresh of [
    { ...cart, totalPaise: 1200, items: [{ ...cart.items[0], unitPricePaise: 1200 }] },
    { ...cart, version: 2, items: [{ ...cart.items[0], quantity: 2 }] },
    { ...cart, items: [] },
    { ...cart, canteenId: 'another-canteen' },
    { ...cart, items: [{ ...cart.items[0], menuItemId: 'coffee' }] },
    { ...cart, available: false },
    { ...cart, items: [{ ...cart.items[0], available: false }] },
  ]) {
    await assert.rejects(submitCheckout({ cart, review: async () => fresh,
      createOrder: () => assert.fail('must not silently order a changed cart') }), /Your cart changed/);
  }
});

function pendingCart() {
  const requests = []; let visible;
  const queue = createCartQueue({
    request: (path, options) => new Promise((resolve, reject) => requests.push({ path, ...options, resolve, reject })),
    changed: state => { visible = state.cart; },
  });
  const item = { id: 'tea', canteenId: 'canteen', name: 'Tea', pricePaise: 1000, available: true };
  const canteen = { operational: true, acceptingOrders: true };
  const add = () => queue.enqueue(() => ({ path: '/cart/items', method: 'POST', values: { menuItemId: 'tea' } }),
    current => addCartItem(current, item, canteen));
  return { queue, requests, add, visible: () => visible,
    review: () => queue.enqueue(current => ({ path: '/cart/review', method: 'POST', values: { quote: current.quote } })),
  };
}

test('checkout waits for pending additions and submits the latest saved version and quote', async () => {
  const s = pendingCart(); const first = s.add(); const second = s.add();
  assert.equal(s.visible().items[0].quantity, 2);
  assert.equal(s.visible().id, 'pending-cart');
  let submissions = 0;
  const checkout = submitCheckout({ cart: s.visible(), review: s.review,
    createOrder: async body => {
      submissions++;
      assert.deepEqual(body, { expectedVersion: 3, quote: 'reviewed-quote' });
      return { id: 'order' };
    } });
  assert.equal(submissions, 0);
  s.requests[0].resolve({ ...cart, canteenId: null, items: [], totalPaise: 0, available: false });
  await setImmediate();
  assert.equal(s.requests[1].path, '/cart/items');
  s.requests[1].resolve({ ...cart, version: 2, quote: 'first-save' }); await first; await setImmediate();
  assert.equal(submissions, 0);
  assert.equal(s.requests[2].body.expectedVersion, 2);
  const saved = { ...cart, version: 3, totalPaise: 2000, quote: 'second-save',
    items: [{ ...cart.items[0], quantity: 2 }] };
  s.requests[2].resolve(saved); await second; await setImmediate();
  assert.equal(submissions, 0);
  assert.equal(s.requests[3].path, '/cart/review');
  assert.deepEqual(s.requests[3].body, { expectedVersion: 3, quote: 'second-save' });
  s.requests[3].resolve({ ...saved, quote: 'reviewed-quote' });
  assert.equal((await checkout).id, 'order');
  assert.equal(submissions, 1);
  s.queue.dispose();
});

test('a failed pending cart save cancels checkout before order submission', async () => {
  const s = pendingCart(); const addition = s.add();
  const checkout = submitCheckout({ cart: s.visible(), review: s.review,
    createOrder: () => assert.fail('a failed save must not submit an order') });
  const failedCheckout = assert.rejects(checkout, /earlier cart update failed/);
  const failedAddition = assert.rejects(addition, /Offline/);
  s.requests[0].resolve({ ...cart, canteenId: null, items: [], totalPaise: 0, available: false });
  await setImmediate();
  s.requests[1].reject(Object.assign(new Error('Offline'), { status: 503 }));
  await Promise.all([failedAddition, failedCheckout]);
  assert.equal(s.requests.length, 2);
  s.queue.dispose();
});
test('failed review cannot submit an order', async () => {
  await assert.rejects(submitCheckout({ cart,
    review: async () => { throw new Error('Item unavailable'); },
    createOrder: () => assert.fail('must not submit after failed validation') }), /Item unavailable/);
});
test('uncertain submissions preserve legacy payloads without checking the emptied cart', async () => {
  const body = { expectedVersion: 4, quote: 'saved-token', pickupAt: 'original-time' };
  await submitCheckout({ cart: null, pendingRequest: { body },
    review: () => assert.fail('retry must preserve the original request'),
    createOrder: async request => { assert.deepEqual(request, body); return { id: 'same-order' }; } });
});

test('an expired token is checked again automatically only when the displayed cart is unchanged', async () => {
  const fresh = { ...cart, quote: 'renewed-token' };
  let calls = 0;
  await submitCheckout({ cart,
    review: async () => {
      if (++calls === 1) throw Object.assign(new Error('Token expired'), { code: 'QUOTE_CHANGED', details: { cart: fresh } });
      return fresh;
    },
    createOrder: async body => { assert.equal(body.quote, fresh.quote); return { id: 'order' }; },
  });
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(submitCheckout({ cart,
    review: async () => {
      calls++;
      throw Object.assign(new Error('Prices changed'), { code: 'QUOTE_CHANGED', details: { cart: { ...fresh, totalPaise: 1200 } } });
    },
    createOrder: () => assert.fail('must not automatically accept changed prices'),
  }), /Prices changed/);
  assert.equal(calls, 1);
});
