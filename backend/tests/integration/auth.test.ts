import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed, provisionAdmin, rotateCode } from '../../src/services/provision.js';

const url = process.env.AUTH_TEST_DATABASE_URL;
test('Supabase Auth integration with real isolated PostgreSQL and mocked email service', { skip: !url }, async t => {
  assert(url);
  const address = new URL(url);
  assert(['localhost', '127.0.0.1'].includes(address.hostname) && address.pathname.includes('test'), 'Auth fixtures require a local dedicated test database');
  assert.notEqual(url, process.env.DATABASE_URL);
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url }, encoding: 'utf8', timeout: 180000,
  });
  assert.equal(migration.status, 0, migration.stderr);
  const config = loadConfig({ DATABASE_URL: url, APP_ENV: 'test', NODE_ENV: 'test', FRONTEND_ORIGIN: 'http://localhost:5173',
    SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SEED_DEVELOPMENT_DATA: 'true', LOG_LEVEL: 'silent', DB_TIMEOUT_MS: '10000',
    SUPABASE_URL: 'https://auth-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_test_123456' });
  const db = createPrisma(config);
  const identities = new Map<string, object>();
  const adminPassword = 'unique test admin password';
  const students = { id: randomUUID(), email: 'student@banasthali.in' };
  const staffA = { id: randomUUID(), email: 'staff-a@example.edu' };
  const staffB = { id: randomUUID(), email: 'staff-b@example.edu' };
  const admin = { id: randomUUID(), email: 'admin@example.edu' };
  let signupCodeConsumed = false;
  function token(user: { id: string; email: string }, method = 'password', timestamp = Math.floor(Date.now() / 1000), extra = {}) {
    const value = `e30.${Buffer.from(JSON.stringify({ sub: user.id, amr: [{ method, timestamp }], nonce: randomUUID() })).toString('base64url')}.signature`;
    identities.set(value, { ...user, email_confirmed_at: new Date().toISOString(), user_metadata: { role: 'ADMIN', name: 'Verified Test User' }, ...extra });
    return value;
  }
  const authFetch = (async (target, init) => {
    if (String(target).includes('/signup?')) return Response.json({}); // No real emails are sent.
    if (String(target).endsWith('/verify')) {
      const body = JSON.parse(init!.body as string);
      if (body.type !== 'signup' || body.email !== students.email || body.token !== '123456' || signupCodeConsumed) return new Response('{}', { status: 401 });
      signupCodeConsumed = true;
      return Response.json({ access_token: token(students, 'email/signup') });
    }
    const value = (init?.headers as Record<string, string>).Authorization?.slice(7);
    return identities.has(value) ? Response.json(identities.get(value)) : new Response('{}', { status: 401 });
  }) as typeof fetch;
  await seed(db, config); await provisionAdmin(db, admin.email, 'Test Admin', adminPassword);
  const canteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'bella-bite' } });
  const otherCanteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'shanu' } });
  const server = createApp(config, db, () => {}, authFetch).listen(0, '127.0.0.1');
  await once(server, 'listening'); const serverAddress = server.address(); assert(serverAddress && typeof serverAddress !== 'string');
  const base = `http://127.0.0.1:${serverAddress.port}/api/v1`;
  class Browser {
    jar = new Map<string, string>(); csrf = '';
    async request(path: string, method = 'GET', body?: object, bearer?: string, headers: Record<string, string> = {}) {
      const response = await fetch(base + path, { method, headers: { Origin: config.FRONTEND_ORIGIN,
        Cookie: [...this.jar].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0]!.split('='); this.jar.set(name!, value!); }
      return { status: response.status, body: await response.json(), headers: response.headers };
    }
    async prepare() { this.csrf = (await this.request('/auth/csrf')).body.csrfToken; return this; }
  }
  const student = await new Browser().prepare(); const a = await new Browser().prepare();
  const b = await new Browser().prepare(); const bOther = await new Browser().prepare(); const administrator = await new Browser().prepare();
  let challengeA: string; let challengeB: string; let memberB: string;
  try {
    await t.test('CSRF and origin checks reject forged and cross-origin session requests', async () => {
      assert.equal((await new Browser().request('/auth/session', 'POST', { role: 'STUDENT' }, token(students))).status, 403);
      assert.equal((await student.request('/auth/session', 'POST', { role: 'STUDENT' }, token(students), { Origin: 'https://evil.example' })).status, 403);
      assert.equal((await student.request('/auth/session', 'POST', { role: 'STUDENT' }, token(students), { 'X-CSRF-Token': 'forged' })).status, 403);
    });
    await t.test('unverified email and wrong institutional domain cannot obtain a student session', async () => {
      assert.equal((await student.request('/auth/session', 'POST', { role: 'STUDENT' }, token(students, 'password', undefined, { email_confirmed_at: null }))).status, 401);
      assert.equal((await student.request('/auth/session', 'POST', { role: 'STUDENT' }, token({ id: randomUUID(), email: 'student@banasthali.in.evil' }))).status, 403);
    });
    await t.test('signup requires a valid one-time code, immediately signs in, then supports password-only login', async () => {
      const signup = token(students, 'email/signup');
      assert.equal((await student.request('/auth/confirm-signup', 'POST', {}, signup)).status, 422);
      assert.equal((await student.request('/auth/confirm-signup', 'POST', { email: students.email, code: '000000' })).status, 401);
      assert.equal((await student.request('/auth/me')).status, 401);
      const verified = await student.request('/auth/confirm-signup', 'POST', { email: students.email, code: '123456' });
      assert.equal(verified.status, 200); assert.equal(verified.body.role, 'STUDENT');
      assert.equal((await student.request('/auth/me')).body.email, students.email);
      assert.equal((await student.request('/auth/confirm-signup', 'POST', { email: students.email, code: '123456' })).status, 401);
      assert.equal((await student.request('/auth/logout', 'POST', {})).status, 200);
      assert.equal((await student.request('/auth/session', 'POST', { role: 'STUDENT' }, signup)).status, 401);
      const response = await student.request('/auth/session', 'POST', { role: 'STUDENT' }, token(students));
      assert.equal(response.status, 200); assert.equal(response.body.role, 'STUDENT');
      assert(response.headers.getSetCookie().some(value => value.includes('HttpOnly') && value.includes('SameSite=Lax')));
      assert.equal((await student.request('/auth/me')).body.email, students.email);
      const local = await db.user.findUniqueOrThrow({ where: { email: students.email } });
      assert.equal(local.supabaseSubject, students.id); assert.equal(local.passwordHash, null);
    });
    await t.test('user metadata and requested role cannot grant administrator access', async () => {
      assert.equal((await student.request('/auth/session', 'POST', { role: 'ADMIN' }, token(students))).status, 403);
      assert.equal(await db.userRole.count({ where: { role: 'ADMIN' } }), 1);
      assert.equal((await student.request('/auth/session', 'POST', { role: 'STUDENT' }, token({ ...students, id: randomUUID() }))).status, 403);
    });
    await t.test('provisioned admin activates by password and links only after verified email', async () => {
      assert.equal((await administrator.request('/auth/admin/activate', 'POST', { email: admin.email, password: 'wrong password' })).status, 401);
      assert.equal((await administrator.request('/auth/admin/activate', 'POST', { email: admin.email, password: adminPassword })).status, 200);
      assert.equal((await administrator.request('/auth/admin/confirm', 'POST', {}, token(admin, 'email/signup'))).status, 200);
      assert.equal((await administrator.request('/auth/me')).status, 401);
      assert.equal((await administrator.request('/auth/session', 'POST', { role: 'ADMIN' }, token(admin))).status, 200);
      assert.equal((await db.user.findUniqueOrThrow({ where: { email: admin.email } })).passwordHash, null);
    });
    await t.test('staff code gate binds email/canteen and rejects stale authentication and replay', async () => {
      assert.equal((await a.request('/auth/canteen/returning', 'POST', { email: staffA.email, canteenId: canteen.id })).status, 403);
      assert.equal((await a.request('/auth/canteen/login', 'POST', { email: staffA.email, canteenId: canteen.id, accessCode: 'wrong' })).status, 401);
      const start = await a.request('/auth/canteen/login', 'POST', { email: staffA.email, canteenId: canteen.id, accessCode: 'Bella Bite' });
      assert.equal(start.status, 200); challengeA = start.body.challengeId;
      assert.equal((await a.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: challengeA }, token(staffB, 'otp'))).status, 401);
      assert.equal((await a.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: challengeA }, token(staffA, 'otp', Math.floor(Date.now() / 1000) - 600))).status, 401);
      assert.equal((await a.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: challengeA }, token(staffA, 'password'))).status, 401);
      assert.equal((await a.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: challengeA }, token(staffA, 'otp'))).status, 200);
      assert.equal((await a.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: challengeA }, token(staffA, 'otp'))).status, 401);
    });
    await t.test('returning staff can log in without the code but still need fresh email verification', async () => {
      assert.equal((await a.request('/auth/canteen/returning', 'POST', { email: staffA.email, canteenId: otherCanteen.id })).status, 403);
      const returning = await a.request('/auth/canteen/returning', 'POST', { email: staffA.email, canteenId: canteen.id });
      assert.equal(returning.status, 200);
      assert.equal((await a.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: returning.body.challengeId }, token(staffA, 'password'))).status, 401);
      assert.equal((await a.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: returning.body.challengeId }, token(staffA, 'otp'))).status, 200);
      assert.equal((await a.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: returning.body.challengeId }, token(staffA, 'otp'))).status, 401);
    });
    await t.test('cross-canteen access and non-admin maintenance are denied', async () => {
      assert.equal((await a.request(`/canteens/${otherCanteen.id}/members`)).status, 403);
      assert.equal((await a.request(`/admin/users/${randomUUID()}`, 'PATCH', { status: 'DISABLED' })).status, 403);
    });
    async function staffLogin(browser: Browser, canteenId: string, accessCode: string) {
      const start = await browser.request('/auth/canteen/login', 'POST', { email: staffB.email, canteenId, accessCode });
      assert.equal(start.status, 200);
      assert.equal((await browser.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: start.body.challengeId }, token(staffB, 'otp'))).status, 200);
    }
    await t.test('member counts use shared sessions across browsers', async () => {
      await staffLogin(b, canteen.id, 'Bella Bite'); await staffLogin(bOther, otherCanteen.id, "Shanu's Canteen");
      const response = await a.request(`/canteens/${canteen.id}/members?limit=1`);
      assert.equal(response.status, 200); assert.equal(response.body.signedInPeople, 2); assert.equal(response.body.sessionCount, 2);
      assert(response.body.nextCursor); assert.equal(response.body.items.length, 1);
      memberB = (await db.canteenMembership.findFirstOrThrow({ where: { user: { email: staffB.email }, canteenId: canteen.id } })).id;
      challengeB = (await b.request('/auth/canteen/login', 'POST', { email: staffB.email, canteenId: canteen.id, accessCode: 'Bella Bite' })).body.challengeId;
    });
    await t.test('removal atomically revokes scoped sessions and pending login without affecting other canteens', async () => {
      assert.equal((await a.request(`/canteens/${canteen.id}/members/${memberB}/revoke`, 'POST', { expectedVersion: 99 })).status, 409);
      assert.equal((await a.request(`/canteens/${canteen.id}/members/${memberB}/revoke`, 'POST', { expectedVersion: 1 })).status, 200);
      assert.equal((await b.request('/auth/me')).status, 401); assert.equal((await bOther.request('/auth/me')).status, 200);
      assert.equal((await b.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: challengeB }, token(staffB, 'otp'))).status, 401);
      assert.equal((await b.request('/auth/canteen/login', 'POST', { email: staffB.email, canteenId: canteen.id, accessCode: 'Bella Bite' })).status, 403);
      assert.equal((await b.request('/auth/canteen/returning', 'POST', { email: staffB.email, canteenId: canteen.id })).status, 403);
      assert.equal((await a.request(`/canteens/${canteen.id}/members`)).body.signedInPeople, 1);
    });
    await t.test('admin restoration requires a fresh login and does not resurrect old sessions', async () => {
      assert.equal((await administrator.request(`/admin/memberships/${memberB}`, 'PATCH', { status: 'ACTIVE', expectedVersion: 2 })).status, 200);
      assert.equal((await b.request('/auth/me')).status, 401);
      await staffLogin(b, canteen.id, 'Bella Bite');
    });
    await t.test('simultaneous removal and pending email completion cannot leave an active revoked session', async () => {
      const start = await b.request('/auth/canteen/login', 'POST', { email: staffB.email, canteenId: canteen.id, accessCode: 'Bella Bite' });
      const [removed, completion] = await Promise.all([
        a.request(`/canteens/${canteen.id}/members/${memberB}/revoke`, 'POST', { expectedVersion: 3 }),
        b.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: start.body.challengeId }, token(staffB, 'otp')),
      ]);
      assert.equal(removed.status, 200); assert([200, 401, 403].includes(completion.status));
      assert.equal((await b.request('/auth/me')).status, 401);
      assert.equal(await db.session.count({ where: { membershipId: memberB, revokedAt: null } }), 0);
      assert.equal((await administrator.request(`/admin/memberships/${memberB}`, 'PATCH', { status: 'ACTIVE', expectedVersion: 4 })).status, 200);
      await staffLogin(b, canteen.id, 'Bella Bite');
    });
    await t.test('access-code rotation invalidates current sessions and pending challenges', async () => {
      const pending = await b.request('/auth/canteen/login', 'POST', { email: staffB.email, canteenId: canteen.id, accessCode: 'Bella Bite' });
      await rotateCode(db, config, 'bella-bite', 'new secure test access code');
      assert.equal((await a.request('/auth/me')).status, 401); assert.equal((await b.request('/auth/me')).status, 401);
      assert.equal((await b.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: pending.body.challengeId }, token(staffB, 'otp'))).status, 401);
      const returning = await b.request('/auth/canteen/returning', 'POST', { email: staffB.email, canteenId: canteen.id });
      assert.equal(returning.status, 403); assert.equal(returning.body.error.code, 'ACCESS_CODE_CHANGED');
    });
    await t.test('password reset revokes all app sessions and disabling prevents new login', async () => {
      assert.equal((await student.request('/auth/revoke-sessions', 'POST', {}, token(students, 'recovery'))).status, 200);
      assert.equal((await student.request('/auth/me')).status, 401);
      const local = await db.user.findUniqueOrThrow({ where: { email: students.email } });
      assert.equal((await administrator.request(`/admin/users/${local.id}`, 'PATCH', { status: 'DISABLED' })).status, 200);
      assert.equal((await student.request('/auth/session', 'POST', { role: 'STUDENT' }, token(students))).status, 403);
    });
    await t.test('shared code-attempt limit rejects repeated guessing', async () => {
      let last = 0;
      for (let attempt = 0; attempt < 21; attempt++) {
        last = (await b.request('/auth/canteen/login', 'POST', { email: 'guessing@example.edu', canteenId: canteen.id, accessCode: 'incorrect' })).status;
      }
      assert.equal(last, 429);
    });
    await t.test('logout revokes the stored session and cookie', async () => {
      const cookie = administrator.jar.get('spoonate_session');
      assert.equal((await administrator.request('/auth/logout', 'POST', {})).status, 200);
      administrator.jar.set('spoonate_session', cookie!);
      assert.equal((await administrator.request('/auth/me')).status, 401);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.$disconnect();
  }
});
