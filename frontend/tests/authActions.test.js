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
    getSession: async () => ({ data: { session } }),
    updateUser: async () => { calls.push(['password']); return { data: {} }; },
    resetPasswordForEmail: async () => ({ data: {} }),
    resend: async value => { calls.push(['resend', value]); return { data: {} }; },
  };
  const api = async (path, value) => {
    calls.push([path, value]);
    if (apiOverride) return apiOverride(path, value);
    if (path === '/auth/canteen/login') return { challengeId: 'challenge', expiresAt: new Date(Date.now() + 600000).toISOString() };
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
test('password recovery revokes application sessions before changing password and signs out globally', async () => {
  const { actions, calls } = setup();
  await actions.changePassword('new strong password');
  assert.deepEqual(calls.map(([path]) => path), ['/auth/revoke-sessions', 'password', 'signout']);
  assert.equal(calls[2][1].scope, 'global');
});
test('signup resend respects cooldown and staff email links require the original challenge', async () => {
  const { actions } = setup();
  await actions.signup({ email: 's@banasthali.in', name: 'Student', password: 'a long password' });
  await assert.rejects(actions.resend(), /wait/);
  actions.clear();
  await assert.rejects(actions.callback('staff'), /browser/);
});
