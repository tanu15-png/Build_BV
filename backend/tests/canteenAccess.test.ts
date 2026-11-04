import test from 'node:test';
import assert from 'node:assert/strict';
import { contracts } from '../src/schemas/contracts.js';
import { canteenMemberEmail, memberName } from '../src/services/canteenAccess.js';

test('canteen member entry requires only a name and access code', () => {
  const schema = contracts['POST /auth/canteen/access']!.body;
  assert.deepEqual(schema.parse({ name: ' Tanu ', accessCode: ' shanu ' }), { name: 'Tanu', accessCode: 'shanu' });
  for (const body of [{ name: '', accessCode: 'shanu' }, { name: 'Tanu' }, { name: 'Tanu', accessCode: 'abc' },
    { name: 'Tanu', accessCode: 'shanu', email: 'unused@example.edu' }, { name: 'Tanu', accessCode: 'shanu', canteenId: 'untrusted' }]) {
    assert.equal(schema.safeParse(body).success, false);
  }
});
test('member identity is stable for spelling case and spaces, and scoped to the canteen', () => {
  assert.equal(memberName('  Tanu   Verma '), 'Tanu Verma');
  assert.equal(canteenMemberEmail('Tanu Verma', 'one'), canteenMemberEmail('  tanu   verma ', 'one'));
  assert.notEqual(canteenMemberEmail('Tanu Verma', 'one'), canteenMemberEmail('Tanu Verma', 'two'));
});
