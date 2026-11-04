import test from 'node:test';
import assert from 'node:assert/strict';
import { contracts } from '../src/schemas/contracts.js';

test('canteen collection requires only the current order version, with no verification code', () => {
  const schema = contracts['POST /orders/:id/collect']!.body;
  assert.deepEqual(schema.parse({ expectedVersion: 4 }), { expectedVersion: 4 });
  for (const body of [{}, { expectedVersion: 0 }, { expectedVersion: 4, code: '42' }, { expectedVersion: 4, canteenId: 'untrusted' }]) {
    assert.equal(schema.safeParse(body).success, false);
  }
});
