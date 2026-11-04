import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogoutRecovery } from '../src/services/logoutRecovery.js';

test('a failed sign-out retains the intent and clears the session after retry', async () => {
  let attempts = 0;
  let user = { role: 'admin' };
  let error = '';
  const recovery = createLogoutRecovery({
    revoke: async () => { if (++attempts === 1) throw new Error('Connection lost'); },
    onSuccess: () => { user = null; error = ''; },
    onError: issue => { error = issue.message; },
  });
  assert.equal(recovery.pending(), false);
  await assert.rejects(recovery.logout(), /Connection lost/);
  assert.equal(recovery.pending(), true);
  assert.equal(user.role, 'admin');
  assert.equal(error, 'Connection lost');
  await recovery.logout();
  assert.equal(attempts, 2);
  assert.equal(recovery.pending(), false);
  assert.equal(user, null);
  assert.equal(error, '');
});

test('concurrent logout clicks and connection retries share one request', async () => {
  let resolve;
  let calls = 0;
  let cleared = 0;
  const recovery = createLogoutRecovery({
    revoke: () => { calls++; return new Promise(done => { resolve = done; }); },
    onSuccess: () => { cleared++; },
    onError: () => assert.fail('sign-out should succeed'),
  });
  const first = recovery.logout();
  const second = recovery.logout();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(recovery.pending(), true);
  resolve();
  await Promise.all([first, second]);
  assert.equal(cleared, 1);
  assert.equal(recovery.pending(), false);
});
