import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelayMs, deliveryError, notificationData } from '../src/services/outbox.js';
test('delivery backoff is bounded and persisted errors omit provider messages and credentials', () => {
  assert.equal(retryDelayMs(1), 1000); assert.equal(retryDelayMs(2), 2000);
  assert.equal(retryDelayMs(1000), 300000);
  assert.equal(deliveryError(new Error('postgres://private:secret@host')), 'Notification delivery failed.');
  assert.equal(deliveryError({ code: 'P2028', message: 'secret' }), 'Delivery failed (P2028).');
});
test('accepted, ready and rejected source events notify the order owner', () => {
  const event = { id: 'event', createdAt: new Date('2026-10-16T12:00:00Z'), newStatus: 'READY',
    order: { id: 'order', studentId: 'student', codeDay: new Date('2026-10-16'), orderCode: 'A01', canteen: { name: 'Bella Bite' } } };
  const notify = notificationData(event as Parameters<typeof notificationData>[0]);
  assert.equal(notify?.recipientId, 'student'); assert.equal(notify?.sourceEventId, 'event');
  assert.equal(notify?.createdAt, event.createdAt); assert.match(notify!.message, /A01 \(2026-10-16\)/);
  const rejected = notificationData({ ...event, newStatus: 'REJECTED' } as Parameters<typeof notificationData>[0]);
  assert.equal(rejected?.recipientId, 'student');
  assert.equal(rejected?.type, 'REJECTED');
  assert.match(rejected!.message, /Bella Bite rejected order A01 \(2026-10-16\)/);
  for (const status of ['RECEIVED', 'PREPARING', 'COLLECTED']) {
    assert.equal(notificationData({ ...event, newStatus: status } as Parameters<typeof notificationData>[0]), null);
  }
});
