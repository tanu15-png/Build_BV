import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../src/config/env.js';
import { supabaseAuth } from '../src/services/supabase.js';
import { AppError } from '../src/middleware/errorHandler.js';
const input = { DATABASE_URL: 'postgresql://localhost/test', FRONTEND_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_key_1234' };
const config = loadConfig(input);
const id = randomUUID();
const jwt = (subject = id) => `e30.${Buffer.from(JSON.stringify({ sub: subject, amr: [{ method: 'otp', timestamp: 123 }] })).toString('base64url')}.signature`;
test('Supabase verifies the exact bearer remotely before using authentication claims', async () => {
  let calls = 0;
  const gateway = supabaseAuth(config, (async (url, options) => {
    calls++; assert.equal(url, 'https://example.supabase.co/auth/v1/user');
    assert.equal((options!.headers as Record<string, string>).Authorization, `Bearer ${jwt()}`);
    return Response.json({ id, email: 'Student@banasthali.in', email_confirmed_at: new Date().toISOString(), user_metadata: { role: 'ADMIN' } });
  }) as typeof fetch);
  const user = await gateway.verify(jwt());
  assert.equal(calls, 1); assert.equal(user.email, 'student@banasthali.in');
  assert.deepEqual(user.authenticationMethods, [{ method: 'otp', timestamp: 123 }]);
});
test('Supabase rejects unverified, anonymous, forged-subject and malformed identities', async () => {
  for (const override of [{ email_confirmed_at: null }, { is_anonymous: true }, { id: randomUUID() }]) {
    const gateway = supabaseAuth(config, (async () => Response.json({ id, email: 's@banasthali.in', email_confirmed_at: new Date().toISOString(), ...override })) as typeof fetch);
    await assert.rejects(gateway.verify(jwt()), e => e instanceof AppError && e.status === 401);
  }
});
test('Supabase failures are mapped without exposing provider responses or credentials', async () => {
  for (const [status, expected] of [[401, 401], [429, 429], [500, 503]]) {
    const gateway = supabaseAuth(config, (async () => new Response('PRIVATE_PROVIDER_RESPONSE', { status })) as typeof fetch);
    await assert.rejects(gateway.verify(jwt()), e => e instanceof AppError && e.status === expected && !e.message.includes('PRIVATE'));
  }
  const gateway = supabaseAuth(config, (async () => { throw new Error('SECRET_CONNECTION_DETAILS'); }) as typeof fetch);
  await assert.rejects(gateway.verify(jwt()), e => e instanceof AppError && e.status === 503 && !e.message.includes('SECRET'));
});
test('Supabase configuration refuses secret browser keys and incomplete pairs', () => {
  assert.throws(() => loadConfig({ ...input, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_for_browser' }));
  assert.throws(() => loadConfig({ ...input, SUPABASE_PUBLISHABLE_KEY: undefined }));
});
test('signup verification submits the numeric OTP and maps rejected or expired codes', async () => {
  const gateway = supabaseAuth(config, (async (url, options) => {
    assert(String(url).endsWith('/verify'));
    assert.deepEqual(JSON.parse(options!.body as string), { type: 'signup', email: 's@banasthali.in', token: '123456' });
    return Response.json({ access_token: jwt() });
  }) as typeof fetch);
  assert.equal(await gateway.verifySignup('s@banasthali.in', '123456'), jwt());
  const rejected = supabaseAuth(config, (async () => new Response('{}', { status: 401 })) as typeof fetch);
  await assert.rejects(rejected.verifySignup('s@banasthali.in', '000000'), e => e instanceof AppError && e.code === 'OTP_INVALID');
});
