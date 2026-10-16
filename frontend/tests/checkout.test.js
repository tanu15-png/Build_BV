import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutSnapshot, submitCheckout } from '../src/services/checkout.js';
const cart = { id: 'cart', canteenId: 'canteen', version: 1, totalPaise: 1000, available: true,
  quote: 'original-token', quoteExpiresAt: 'old-expiry',
  items: [{ id: 'line', menuItemId: 'tea', name: 'Tea', quantity: 1, unitPricePaise: 1000, available: true }] };
const pickupAt = () => '2026-10-16T12:00:00Z';
test('refreshing the verification token does not change the reviewed cart', async () => {
  const fresh = { ...cart, quote: 'new-token', quoteExpiresAt: 'new-expiry' };
  assert.equal(checkoutSnapshot(cart), checkoutSnapshot(fresh));
  const order = await submitCheckout({ cart, pickupAt, review: async () => fresh,
    createOrder: async body => {
      assert.deepEqual(body, { expectedVersion: 1, quote: 'new-token', pickupAt: pickupAt() });
      return { id: 'order' };
    } });
  assert.equal(order.id, 'order');
});
test('actual price, quantity, item, or canteen changes require reviewing the displayed cart again', async () => {
  for (const fresh of [
    { ...cart, totalPaise: 1200, items: [{ ...cart.items[0], unitPricePaise: 1200 }] },
    { ...cart, version: 2, items: [{ ...cart.items[0], quantity: 2 }] },
    { ...cart, items: [] },
    { ...cart, available: false },
    { ...cart, items: [{ ...cart.items[0], available: false }] },
  ]) {
    await assert.rejects(submitCheckout({ cart, pickupAt, review: async () => fresh,
      createOrder: () => assert.fail('must not silently order a changed cart') }), /Your cart changed/);
  }
});
test('failed review cannot submit an order', async () => {
  await assert.rejects(submitCheckout({ cart, pickupAt,
    review: async () => { throw new Error('Item unavailable'); },
    createOrder: () => assert.fail('must not submit after failed validation') }), /Item unavailable/);
});
test('uncertain submissions retry their original payload without checking the emptied cart', async () => {
  const body = { expectedVersion: 4, quote: 'saved-token', pickupAt: 'original-time' };
  await submitCheckout({ cart: null, pickupAt, pendingRequest: { body },
    review: () => assert.fail('retry must preserve the original request'),
    createOrder: async request => { assert.deepEqual(request, body); return { id: 'same-order' }; } });
});

test('an expired token is checked again automatically only when the displayed cart is unchanged', async () => {
  const fresh = { ...cart, quote: 'renewed-token' };
  let calls = 0;
  await submitCheckout({ cart, pickupAt,
    review: async () => {
      if (++calls === 1) throw Object.assign(new Error('Token expired'), { code: 'QUOTE_CHANGED', details: { cart: fresh } });
      return fresh;
    },
    createOrder: async body => { assert.equal(body.quote, fresh.quote); return { id: 'order' }; },
  });
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(submitCheckout({ cart, pickupAt,
    review: async () => {
      calls++;
      throw Object.assign(new Error('Prices changed'), { code: 'QUOTE_CHANGED', details: { cart: { ...fresh, totalPaise: 1200 } } });
    },
    createOrder: () => assert.fail('must not automatically accept changed prices'),
  }), /Prices changed/);
  assert.equal(calls, 1);
});
