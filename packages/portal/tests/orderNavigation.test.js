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
