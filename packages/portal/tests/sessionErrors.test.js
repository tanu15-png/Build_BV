import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionEnded, logoutFailure } from '../src/services/sessionErrors.js';

test('an origin rejection remains visible instead of being mistaken for an expired session', () => {
  const error = { status: 403, code: 'ORIGIN_DENIED', message: 'Open http://localhost:5176 for the admin website.' };
  assert.equal(sessionEnded(error), false);
  assert.equal(logoutFailure(error), `Sign-out could not be confirmed. ${error.message}`);
  assert.equal(sessionEnded({ status: 403, code: 'CSRF_INVALID' }), false);
  assert.equal(sessionEnded({ status: 503, code: 'NETWORK_ERROR' }), false);
  assert.equal(sessionEnded({ status: 401, code: 'SESSION_EXPIRED' }), true);
  assert.equal(sessionEnded({ status: 403, code: 'ROLE_DENIED' }), true);
  assert.equal(sessionEnded({ status: 403, code: 'PORTAL_ROLE_DENIED' }), true);
});
