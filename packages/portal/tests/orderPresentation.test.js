import test from 'node:test';
import assert from 'node:assert/strict';
import { newestOrderFirst, orderReceivedTime } from '../src/utils/orderRules.js';

test('canteen orders stay newest first even when an older order was just updated', () => {
  const orders = [
    { id: 'old', createdAt: '2026-10-22T10:00:00Z', updatedAt: '2026-10-23T10:00:00Z' },
    { id: 'new-b', createdAt: '2026-10-22T11:00:00Z' },
    { id: 'new-a', createdAt: '2026-10-22T11:00:00Z' },
  ];
  assert.deepEqual([...orders].sort(newestOrderFirst).map(order => order.id), ['new-b', 'new-a', 'old']);
});

test('receipt time shows the date and time in IST across campus midnight', () => {
  const label = orderReceivedTime({ createdAt: '2026-10-22T18:40:00Z' });
  assert.match(label, /23 Oct 2026/);
  assert.match(label, /12:10/i);
  assert.match(label, /am/i);
  assert.match(label, /IST$/);
});
