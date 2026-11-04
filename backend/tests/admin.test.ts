import test from 'node:test';
import assert from 'node:assert/strict';
import { adminOrderWhere, adminOverview } from '../src/services/admin.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { contracts } from '../src/schemas/contracts.js';
test('admin queries enforce bounded pagination, explicit filters and valid date ranges', () => {
  const query = contracts['GET /admin/orders']!.query;
  assert.equal(query.safeParse({ limit: 101 }).success, false);
  assert.equal(query.safeParse({ studentId: 'untrusted' }).success, false);
  assert.equal(query.safeParse({ codeDay: '2026-02-30' }).success, false);
  assert.throws(() => adminOrderWhere({ limit: 25, from: '2026-10-17T00:00:00Z', to: '2026-10-16T00:00:00Z' }), { status: 422 });
  const where = adminOrderWhere({ limit: 25, canteenId: 'canteen', status: 'COLLECTED', orderCode: 'A01', codeDay: '2026-10-16', search: 'Tea' });
  assert.equal(where.canteenId, 'canteen'); assert.equal(where.orderCode, 'A01'); assert.equal(where.status, 'COLLECTED');
});
test('admin maintenance contracts reject empty edits, unsupported fields and malformed concurrency tokens', () => {
  assert.equal(contracts['PATCH /admin/canteens/:id']!.body.safeParse({ expectedVersion: 1 }).success, false);
  assert.equal(contracts['PATCH /admin/canteens/:id']!.body.safeParse({ expectedVersion: 1, location: 'unused' }).success, false);
  assert.equal(contracts['PATCH /admin/users/:id']!.body.safeParse({ status: 'DISABLED', expectedUpdatedAt: 'invalid' }).success, false);
  assert.equal(contracts['POST /admin/canteens/:id/access-code']!.body.safeParse({ accessCode: 'abc' }).success, false);
  contracts['POST /admin/canteens/:id/access-code']!.body.parse({ accessCode: 'shanu' });
  contracts['POST /admin/canteens/:id/access-code']!.body.parse({ accessCode: 'new secure join phrase', expectedCodeVersion: 0 });
});

test('daily summaries isolate order counts and collected value while retaining all canteens', async () => {
  const records = [
    { day: '2026-10-22', canteenId: 'one', status: 'RECEIVED', count: 2, value: 2000 },
    { day: '2026-10-22', canteenId: 'one', status: 'COLLECTED', count: 3, value: 6000 },
    { day: '2026-10-22', canteenId: 'one', status: 'REJECTED', count: 1, value: 1000 },
    { day: '2026-10-21', canteenId: 'two', status: 'COLLECTED', count: 50, value: 999999 },
  ];
  const tx = {
    canteen: { findMany: async () => [
      { id: 'one', operational: true, acceptingOrders: true },
      { id: 'two', operational: true, acceptingOrders: false },
    ] },
    order: { groupBy: async ({ where }: { where: { codeDay: Date } }) => records
      .filter(record => record.day === where.codeDay.toISOString().slice(0, 10))
      .map(record => ({ canteenId: record.canteenId, status: record.status, _count: { _all: record.count }, _sum: { totalPaise: record.value } })) },
    menuItem: { groupBy: async () => [{ canteenId: 'two', _count: { _all: 5 } }] },
    canteenAccessCode: { findMany: async () => [] },
  } as unknown as Prisma.TransactionClient;
  const summary = await adminOverview(tx, '2026-10-22');
  assert.equal(summary.day, '2026-10-22');
  assert.equal(summary.totalOrders, 6); assert.equal(summary.activeOrders, 2);
  assert.equal(summary.collectedOrders, 3); assert.equal(summary.collectedValuePaise, 6000);
  assert.equal(summary.totalCanteens, 2);
  assert.equal(summary.canteens[1]!.totalOrders, 0); assert.equal(summary.canteens[1]!.menuItemCount, 5);
  const previous = await adminOverview(tx, '2026-10-21');
  assert.equal(previous.totalOrders, 50); assert.equal(previous.collectedValuePaise, 999999);
  const empty = await adminOverview(tx, '2026-10-23');
  assert.equal(empty.totalOrders, 0); assert.equal(empty.collectedValuePaise, 0); assert.equal(empty.canteens.length, 2);
});

test('summary date query accepts only a real calendar day', () => {
  const query = contracts['GET /admin/overview']!.query;
  assert.deepEqual(query.parse({ day: '2026-10-22' }), { day: '2026-10-22' });
  assert.deepEqual(query.parse({}), {});
  for (const day of ['2026-02-30', 'invalid', '2026-10-22T00:00:00Z']) assert.equal(query.safeParse({ day }).success, false);
});
