import test from 'node:test';
import assert from 'node:assert/strict';
import { campusDay, pickupTime } from '../src/services/orders.js';
test('pickup allocation day uses the campus midnight and pickup bounds use server time', () => {
  assert.equal(campusDay(new Date('2026-11-01T18:29:59.999Z')), '2026-11-01');
  assert.equal(campusDay(new Date('2026-11-01T18:30:00.000Z')), '2026-11-02');
  const now = new Date('2026-11-01T10:00:00Z');
  assert.equal(pickupTime('2026-11-01T16:00:00+05:30', now).toISOString(), '2026-11-01T10:30:00.000Z');
  assert.equal(pickupTime('2026-11-01T11:00:00Z', now).toISOString(), '2026-11-01T11:00:00.000Z');
  for (const value of ['invalid', now.toISOString(), '2026-11-01T09:59:00Z', '2026-11-01T11:00:00.001Z']) assert.throws(() => pickupTime(value, now));
});

import type { PrismaClient } from '../src/generated/prisma/client.js';
import { orderTransaction } from '../src/services/orders.js';
test('serialization/deadlock retries are bounded and return a retryable error', async () => {
  let calls = 0;
  const db = { $transaction: async () => { if (++calls < 3) throw { code: 'P2034' }; return 'committed'; } } as unknown as PrismaClient;
  assert.equal(await orderTransaction(db, 1000, async () => 'ignored'), 'committed'); assert.equal(calls, 3);
  calls = 0;
  const blocked = { $transaction: async () => { calls++; throw { code: 'P2034' }; } } as unknown as PrismaClient;
  await assert.rejects(orderTransaction(blocked, 1000, async () => 'ignored'), { status: 503, code: 'TRANSACTION_BUSY' }); assert.equal(calls, 3);
});
