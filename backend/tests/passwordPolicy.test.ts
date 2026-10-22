import test from 'node:test';
import assert from 'node:assert/strict';
import { contracts } from '../src/schemas/contracts.js';

test('signup and password reset accept passwords from 8 to 256 characters', () => {
  const requests = [
    { route: 'POST /auth/student/signup', body: { name: 'Student', email: 's@banasthali.in' } },
    { route: 'POST /auth/student/password-reset/complete', body: { challengeId: '00000000-0000-4000-8000-000000000001', code: '123456' } },
  ];
  for (const { route, body } of requests) {
    const schema = contracts[route]!.body;
    for (const length of [7, 8, 256, 257]) {
      assert.equal(schema.safeParse({ ...body, password: 'x'.repeat(length) }).success, length >= 8 && length <= 256, `${route}: ${length} characters`);
    }
  }
});
