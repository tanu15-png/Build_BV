import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthActions, pendingAuthKey } from '../src/services/authActions.js';
function setup({ apiOverride } = {}) {
  const values = new Map();
  const calls = [];
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const session = { access_token: 'verified-token' };
  const auth = {
    signUp: async value => { calls.push(['signup', value]); return { data: { session: null } }; },
    signInWithPassword: async value => { calls.push(['password-login', value]); return { data: { session } }; },
    signInWithOtp: async value => { calls.push(['email', value]); return { data: {} }; },
    signOut: async value => { calls.push(['signout', value]); return { data: {} }; },
    verifyOtp: async value => { calls.push(['verify', value]); return { data: { session } }; },
    getSession: async () => ({ data: { session: { ...session, user: { email: 's@banasthali.in' } } } }),
    updateUser: async () => { calls.push(['password']); return { data: {} }; },
    resetPasswordForEmail: async (...value) => { calls.push(['reset-email', ...value]); return { data: {} }; },
    resend: async value => { calls.push(['resend', value]); return { data: {} }; },
  };
  const api = async (path, value) => {
    calls.push([path, value]);
    if (apiOverride) return apiOverride(path, value);
    if (['/auth/canteen/login', '/auth/canteen/returning'].includes(path)) return { challengeId: 'challenge', expiresAt: new Date(Date.now() + 600000).toISOString() };
    if (path === '/auth/session') return { role: value.body.role, id: 'user' };
    if (path === '/auth/confirm-signup') return { role: 'STUDENT', id: 'user' };
    return { ok: true };
  };
  return { actions: createAuthActions({ auth, api, storage, origin: 'https://spoonate.example' }), storage, calls, auth };
}
test('signup requires OTP, stores no password and signs in immediately after server verification', async () => {
  const { actions, calls, storage } = setup();
  await assert.rejects(actions.signup({ email: 's@banasthali.in.evil', name: 'S', password: 'a long password' }));
  await actions.signup({ email: 'S@BANASTHALI.IN', name: 'Student', password: 'a long password' });
  assert.equal(actions.pending().email, 's@banasthali.in');
  assert(!storage.getItem(pendingAuthKey).includes('password'));
  assert(!calls.some(([path]) => path === '/auth/session'));
  const result = await actions.verify('123456');
  assert.deepEqual(result, { role: 'STUDENT', id: 'user' });
  const verification = calls.find(([path]) => path === '/auth/confirm-signup');
  assert.deepEqual(verification[1].body, { email: 's@banasthali.in', code: '123456' });
  assert.equal(actions.pending(), null);
  assert(!calls.some(([path]) => path === '/auth/session'));
  assert(!calls.some(([path]) => ['signout', 'password-login'].includes(path)));
});
test('regular login uses email and password without requesting or verifying an OTP', async () => {
  const { actions, calls } = setup();
  const result = await actions.login({ email: 'S@banasthali.in', password: 'a long password', role: 'student' });
  assert.equal(result.role, 'STUDENT');
  assert.deepEqual(calls.map(([path]) => path), ['password-login', '/auth/session']);
  assert.deepEqual(calls[0][1], { email: 's@banasthali.in', password: 'a long password' });
});
test('failed verification keeps signup pending so a new OTP can be requested and an eight-digit code verified', async () => {
  let attempts = 0;
  const { actions, calls, storage } = setup({ apiOverride: async path => {
    assert.equal(path, '/auth/confirm-signup');
    if (++attempts === 1) throw new Error('Invalid or expired code.');
    return { role: 'STUDENT', id: 'user' };
  } });
  await actions.signup({ email: 's@banasthali.in', name: 'Student', password: 'a long password' });
  await assert.rejects(actions.verify('12345678'), /expired/);
  assert.equal(actions.pending().email, 's@banasthali.in');
  storage.setItem(pendingAuthKey, JSON.stringify({ ...actions.pending(), resendAfter: 0 }));
  await actions.resend();
  assert.deepEqual(calls.find(([path]) => path === 'resend')[1], {
    type: 'signup', email: 's@banasthali.in', options: { emailRedirectTo: 'https://spoonate.example/auth/callback?flow=signup' },
  });
  await assert.rejects(actions.resend(), /wait/);
  assert.equal((await actions.verify('87654321')).role, 'STUDENT');
  assert.equal(actions.pending(), null);
});
test('an obfuscated existing-account signup response does not claim an OTP was sent', async () => {
  const { actions, auth } = setup();
  auth.signUp = async () => ({ data: { user: { identities: [] }, session: null } });
  await assert.rejects(actions.signup({ email: 's@banasthali.in', name: 'Student', password: 'a long password' }), /Log in with your password/);
  assert.equal(actions.pending(), null);
});
test('email delivery errors preserve the pending signup and do not start a false resend cooldown', async () => {
  const { actions, auth } = setup();
  auth.signInWithPassword = async () => ({ error: { code: 'email_not_confirmed' } });
  await actions.login({ email: 's@banasthali.in', password: 'a long password', role: 'student' });
  auth.resend = async () => ({ error: new Error('Email delivery failed') });
  await assert.rejects(actions.resend(), /delivery failed/);
  assert.equal(actions.pending().resendAfter, 0);
  assert.equal(actions.pending().email, 's@banasthali.in');
});
test('signup confirmation links cannot replace the OTP entry flow', async () => {
  const { actions, calls } = setup();
  await assert.rejects(actions.callback('signup'), /signup OTP/);
  assert.equal(calls.length, 0);
});
test('unverified password login opens OTP verification without sending email or exposing resend on login', async () => {
  const { actions, auth, calls } = setup();
  auth.signInWithPassword = async () => ({ error: { code: 'email_not_confirmed' } });
  assert.deepEqual(await actions.login({ email: 's@banasthali.in', password: 'a long password', role: 'student' }), { pending: true });
  assert.equal(actions.pending().flow, 'signup'); assert.equal(actions.pending().resendAfter, 0);
  assert.equal(calls.length, 0);
});
test('staff validates the canteen code before requesting email, binds verification and cannot reuse pending state', async () => {
  const { actions, calls } = setup();
  await actions.staff({ email: 'staff@example.com', canteenId: 'canteen', accessCode: 'secret' });
  assert.equal(calls[0][0], '/auth/canteen/login'); assert.equal(calls[1][0], 'email');
  assert(!JSON.stringify(actions.pending()).includes('secret'));
  await actions.verify('123456');
  const exchange = calls.find(([path]) => path === '/auth/session');
  assert.deepEqual(exchange[1].body, { role: 'CANTEEN', challengeId: 'challenge' });
  await assert.rejects(actions.verify('123456'));
});
test('signup fails closed when Supabase email confirmation is disabled', async () => {
  const { actions, auth, calls } = setup();
  auth.signUp = async () => ({ data: { session: { access_token: 'premature' } } });
  await assert.rejects(actions.signup({ email: 's@banasthali.in', name: 'Student', password: 'a long password' }), /confirmation must be enabled/);
  assert(calls.some(([path]) => path === 'signout'));
  assert(!calls.some(([path]) => path === '/auth/session'));
});
test('returning canteen members verify email without resending an access code', async () => {
  const { actions, calls } = setup();
  await actions.staff({ email: 'STAFF@example.com', canteenId: 'canteen', returning: true });
  assert.deepEqual(calls[0], ['/auth/canteen/returning', { method: 'POST', body: { email: 'staff@example.com', canteenId: 'canteen' } }]);
  assert.equal(calls[1][0], 'email');
  assert.equal((await actions.verify('12345678')).role, 'CANTEEN');
  assert.deepEqual(calls.find(([path]) => path === '/auth/session')[1].body, { role: 'CANTEEN', challengeId: 'challenge' });
});
test('unknown or revoked canteen members cannot request returning-member verification', async () => {
  const { actions, calls } = setup({ apiOverride: async () => { throw new Error('No active membership'); } });
  await assert.rejects(actions.staff({ email: 'staff@example.com', canteenId: 'canteen', returning: true }), /No active membership/);
  assert(!calls.some(([path]) => path === 'email'));
  assert.equal(actions.pending(), null);
});
test('canteen verification accepts pasted codes and keeps invalid codes pending for resend', async () => {
  const { actions, auth, calls, storage } = setup();
  await actions.staff({ email: 'staff@example.com', canteenId: 'canteen', accessCode: 'secret' });
  const verify = auth.verifyOtp;
  auth.verifyOtp = async () => ({ error: { code: 'otp_expired', message: 'Token has expired or is invalid' } });
  await assert.rejects(actions.verify('12345678'), /newest canteen sign-in email/);
  assert.equal(actions.pending().flow, 'staff');
  assert(!calls.some(([path]) => path === '/auth/session'));
  storage.setItem(pendingAuthKey, JSON.stringify({ ...actions.pending(), resendAfter: 0 }));
  await actions.resend();
  assert.equal(calls.filter(([path]) => path === 'email').length, 2);
  auth.verifyOtp = verify;
  assert.equal((await actions.verify(' 87654321 ')).role, 'CANTEEN');
  assert.deepEqual(calls.find(([path]) => path === 'verify')[1], { email: 'staff@example.com', token: '87654321', type: 'email' });
});
test('expired canteen challenges require a fresh access-code check before verifying or resending', async () => {
  const { actions, calls, storage } = setup();
  await actions.staff({ email: 'staff@example.com', canteenId: 'canteen', accessCode: 'secret' });
  storage.setItem(pendingAuthKey, JSON.stringify({ ...actions.pending(), expiresAt: new Date(Date.now() - 1000).toISOString(), resendAfter: 0 }));
  await assert.rejects(actions.verify('12345678'), /Start again with your access code/);
  await assert.rejects(actions.resend(), /Start again with your access code/);
  assert(!calls.some(([path]) => path === 'verify' || path === '/auth/session'));
  assert.equal(calls.filter(([path]) => path === 'email').length, 1);
});
test('password recovery ends old sessions and automatically creates a new signed-in session', async () => {
  const { actions, calls } = setup();
  const actor = await actions.changePassword('new strong password');
  assert.equal(actor.role, 'STUDENT');
  assert.deepEqual(calls.map(([path]) => path), ['/auth/revoke-sessions', 'password', 'signout', 'password-login', '/auth/session']);
  assert.equal(calls[2][1].scope, 'global');
  assert.deepEqual(calls[3][1], { email: 's@banasthali.in', password: 'new strong password' });
});
test('password reset requests a recovery code and verifies it before changing the password', async () => {
  const { actions, calls } = setup();
  await actions.reset('S@BANASTHALI.IN', 'student');
  assert.equal(actions.pending().email, 's@banasthali.in');
  assert.equal(actions.pending().flow, 'reset');
  assert.deepEqual(calls, [['reset-email', 's@banasthali.in', { redirectTo: 'https://spoonate.example/auth/callback?flow=reset&role=student' }]]);
  assert.deepEqual(await actions.verify('12345678'), { recovery: true });
  assert.deepEqual(calls[1], ['verify', { email: 's@banasthali.in', token: '12345678', type: 'recovery' }]);
  assert(!calls.some(([path]) => path === 'password'));
  await actions.changePassword('new strong password');
  assert.deepEqual(calls.slice(2).map(([path]) => path), ['/auth/revoke-sessions', 'password', 'signout', 'password-login', '/auth/session']);
  assert.equal(actions.pending(), null);
});
test('admin password reset automatically signs in with the pending admin role', async () => {
  const { actions, calls } = setup();
  await actions.reset('s@banasthali.in', 'admin');
  await actions.verify('123456');
  assert.equal((await actions.changePassword('new strong password')).role, 'ADMIN');
  assert.deepEqual(calls.find(([path]) => path === '/auth/session')[1].body, { role: 'ADMIN' });
  assert.equal(actions.pending(), null);
});
test('failed password update or session revocation does not start automatic login', async () => {
  for (const failure of ['revoke', 'update']) {
    const { actions, calls, auth } = setup({ apiOverride: async () => {
      if (failure === 'revoke') throw new Error('Revocation failed');
      return { ok: true };
    } });
    if (failure === 'update') auth.updateUser = async () => ({ error: new Error('Update failed') });
    await assert.rejects(actions.changePassword('new strong password'), /failed/);
    assert(!calls.some(([path]) => path === 'password-login' || path === '/auth/session'));
  }
});
test('failed application session exchange cleans up automatic password login', async () => {
  const { actions, calls } = setup({ apiOverride: async path => {
    if (path === '/auth/session') throw new Error('Account disabled');
    return { ok: true };
  } });
  await assert.rejects(actions.changePassword('new strong password'), /Account disabled/);
  assert.deepEqual(calls.at(-1), ['signout', { scope: 'local' }]);
});
test('invalid, expired and mismatched recovery codes cannot advance to a new password', async () => {
  const { actions, calls, auth } = setup();
  await actions.reset('s@banasthali.in', 'student');
  await assert.rejects(actions.verify('not-a-code'), /Enter the code/);
  auth.verifyOtp = async () => ({ error: new Error('Invalid or expired code') });
  await assert.rejects(actions.verify('123456'), /Invalid or expired/);
  auth.verifyOtp = async () => ({ data: { session: null } });
  await assert.rejects(actions.verify('123456'), /expired/);
  auth.verifyOtp = async () => ({ data: { session: { access_token: 'token', user: { email: 'other@banasthali.in' } } } });
  await assert.rejects(actions.verify('123456'), /different email/);
  assert.equal(actions.pending().flow, 'reset');
  assert(!calls.some(([path]) => path === 'password' || path === '/auth/revoke-sessions'));
});
test('reset code resend respects cooldown and delivery failures allow retry', async () => {
  const { actions, calls, auth, storage } = setup();
  await actions.reset('s@banasthali.in', 'student');
  await assert.rejects(actions.resend(), /wait/);
  storage.setItem(pendingAuthKey, JSON.stringify({ ...actions.pending(), resendAfter: 0 }));
  const send = auth.resetPasswordForEmail;
  auth.resetPasswordForEmail = async () => ({ error: new Error('Email delivery failed') });
  await assert.rejects(actions.resend(), /delivery failed/);
  assert.equal(actions.pending().resendAfter, 0);
  auth.resetPasswordForEmail = send;
  await actions.resend();
  assert.equal(calls.filter(([path]) => path === 'reset-email').length, 2);
  assert(actions.pending().resendAfter > Date.now());
  await assert.rejects(actions.resend(), /wait/);
});
test('signup resend respects cooldown and staff email links require the original challenge', async () => {
  const { actions } = setup();
  await actions.signup({ email: 's@banasthali.in', name: 'Student', password: 'a long password' });
  await assert.rejects(actions.resend(), /wait/);
  actions.clear();
  await assert.rejects(actions.callback('staff'), /browser/);
});
