import test from 'node:test';
import assert from 'node:assert/strict';
import { withoutCustomerNames } from '../src/services/orderPrivacy.js';
import { contracts } from '../src/schemas/contracts.js';

test('canteen order responses omit names from lists, conflict details and legacy replays without mutating stored data', () => {
  const order = { id: 'order', studentName: 'Private name', orderCode: 'ABC', items: [{ name: 'Tea', quantity: 1 }] };
  const saved = { items: [order], error: { details: { order } } };
  const result = withoutCustomerNames(saved);
  assert(!JSON.stringify(result).includes('Private name'));
  assert(!JSON.stringify(result).includes('studentName'));
  assert(JSON.stringify(result).includes('Tea'));
  assert.equal(order.studentName, 'Private name');
});

test('checkout accepts an unscheduled order while preserving legacy request validation', () => {
  assert.deepEqual(contracts['POST /orders']!.body.parse({ expectedVersion: 1, quote: 'signed-quote' }), { expectedVersion: 1, quote: 'signed-quote' });
  assert.equal(contracts['POST /orders']!.body.safeParse({ expectedVersion: 1, quote: 'quote', pickupAt: 'invalid' }).success, false);
});
