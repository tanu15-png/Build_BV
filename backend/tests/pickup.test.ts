import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptPickupCode, decryptPickupCode, generatePickupCode, matchesPickupCode, collectionRequestHash } from '../src/services/pickup.js';
import { contracts } from '../src/schemas/contracts.js';
test('private pickup codes are random numbers from 1 to 100', () => {
  for (let index = 0; index < 128; index++) assert.match(generatePickupCode(), /^(?:[1-9][0-9]?|100)$/);
});
test('pickup encryption is randomized, authenticated and bound to the exact order', () => {
  const secret = 's'.repeat(32);
  for (const code of ['1', '9', '10', '99', '100']) {
    assert.equal(decryptPickupCode(encryptPickupCode(code, 'order-a', secret), 'order-a', secret), code);
  }
  const first = encryptPickupCode('42', 'order-a', secret);
  assert.notEqual(first, encryptPickupCode('42', 'order-a', secret));
  assert.equal(decryptPickupCode(first, 'order-a', secret), '42');
  assert.equal(matchesPickupCode(first, '42', 'order-a', secret), true);
  assert.equal(matchesPickupCode(first, '43', 'order-a', secret), false);
  assert.throws(() => decryptPickupCode(first, 'order-b', secret));
  assert.throws(() => decryptPickupCode(first, 'order-a', 'other-secret'));
  assert.throws(() => encryptPickupCode('A01', 'order-a', secret));
  assert.throws(() => decryptPickupCode('malformed', 'order-a', secret));
});
test('collection contract rejects public references, missing/malformed codes, and extra fields', () => {
  const schema = contracts['POST /orders/:id/collect']!.body;
  assert.deepEqual(schema.parse({ expectedVersion: 4, code: ' 42 ' }), { expectedVersion: 4, code: '42' });
  for (const code of ['1', '9', '10', '99', '100']) {
    schema.parse({ expectedVersion: 4, code });
    contracts['GET /orders/:id/pickup-code']!.response.parse({ code });
  }
  for (const code of ['', '0', '01', '101', '1000', '-1', '1.5', 'A01', 42, null, undefined]) assert.equal(schema.safeParse({ expectedVersion: 4, code }).success, false);
  assert.equal(schema.safeParse({ expectedVersion: 4, code: '42', canteenId: 'untrusted' }).success, false);
  assert.notEqual(collectionRequestHash({ code: '42' }, 'secret-a'), collectionRequestHash({ code: '42' }, 'secret-b'));
});
