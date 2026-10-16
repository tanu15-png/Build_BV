import test from 'node:test';
import assert from 'node:assert/strict';
import { adminOrderWhere } from '../src/services/admin.js';
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
  assert.equal(contracts['POST /admin/canteens/:id/access-code']!.body.safeParse({ accessCode: 'short' }).success, false);
  contracts['POST /admin/canteens/:id/access-code']!.body.parse({ accessCode: 'new secure join phrase', expectedCodeVersion: 0 });
});
