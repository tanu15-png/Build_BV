import test from 'node:test';
import assert from 'node:assert/strict';
import { orderReturnLocation } from '../src/utils/orderNavigation.js';
test('tracking returns to its originating page including its filters and anchor', () => {
  assert.deepEqual(orderReturnLocation('/dashboard/notifications'), { to: '/dashboard/notifications', label: 'Notifications' });
  assert.deepEqual(orderReturnLocation('/dashboard/orders?tab=Completed'), { to: '/dashboard/orders?tab=Completed', label: 'My orders' });
  assert.deepEqual(orderReturnLocation('/dashboard#cafes'), { to: '/dashboard#cafes', label: 'Dashboard' });
  assert.equal(orderReturnLocation('/dashboard/order-success?id=123').label, 'Order confirmation');
});
test('direct links and invalid return destinations use the safe orders fallback', () => {
  for (const value of [null, undefined, 'https://example.com', '//example.com', '/dashboard/orders/order-id', '/login', 42]) {
    assert.deepEqual(orderReturnLocation(value), { to: '/dashboard/orders', label: 'My orders' });
  }
});

test('reward amounts show the saved token cost while paid orders retain rupees', async () => {
  const { orderAmountLabel } = await import('../src/utils/orderRules.js');
  assert.equal(orderAmountLabel({ executionMode: 'REWARD', rewardTokenCost: 40, total: 0 }), '40 tokens');
  assert.equal(orderAmountLabel({ executionMode: 'REWARD', rewardTokenCost: 100, total: 0 }), '100 tokens');
  assert.equal(orderAmountLabel({ executionMode: 'REWARD', total: 0 }), 'Token reward');
  assert.equal(orderAmountLabel({ executionMode: 'TEST', total: 560 }), '₹560');
  assert.equal(orderAmountLabel({ executionMode: 'RAZORPAY_TEST', totalPaise: 9050 }), '₹90.5');
});
