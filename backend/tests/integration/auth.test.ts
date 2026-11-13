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
    ADMIN_ACCESS_PASSWORD: 'test-team-password', SUPABASE_URL: 'https://auth-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_test_123456' });
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
  const canteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'canteen' } });
  const otherCanteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'canteen' } });
  const server = createApp(config, db, () => {}, authFetch).listen(0, '127.0.0.1');
  await once(server, 'listening'); const serverAddress = server.address(); assert(serverAddress && typeof serverAddress !== 'string');
  const base = `http://127.0.0.1:${serverAddress.port}/api/v1`;
  class Browser {
    constructor(readonly portal = 'student') {}
    jar = new Map<string, string>(); csrf = '';
    async request(path: string, method = 'GET', body?: object, bearer?: string, headers: Record<string, string> = {}) {
      const response = await fetch(base + '/' + this.portal + path, { method, headers: { Origin: this.portal === 'student' ? config.FRONTEND_ORIGIN : this.portal === 'canteen' ? config.CANTEEN_ORIGIN : config.ADMIN_ORIGIN,
        Cookie: [...this.jar].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0]!.split('='); this.jar.set(name!, value!); }
      return { status: response.status, body: await response.json(), headers: response.headers };
    }
    async prepare() { this.csrf = (await this.request('/auth/csrf')).body.csrfToken; return this; }
  }
  const student = await new Browser().prepare(); const a = await new Browser('canteen').prepare();
  const administrator = new Browser('admin');
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
    await t.test('retired admin portal and legacy staff authentication are inaccessible',async()=>{
      assert.equal((await administrator.request('/auth/admin/password','POST',{password:config.ADMIN_ACCESS_PASSWORD})).status,404);
      assert.equal((await administrator.request('/auth/me')).status,404);
    });
    await t.test('password reset revokes all app sessions and disabling prevents new login', async () => {
      assert.equal((await student.request('/auth/revoke-sessions', 'POST', {}, token(students, 'recovery'))).status, 200);
      assert.equal((await student.request('/auth/me')).status, 401);
      const local = await db.user.findUniqueOrThrow({ where: { email: students.email } });
      await db.user.update({where:{id:local.id},data:{status:'DISABLED'}});
      assert.equal((await student.request('/auth/session', 'POST', { role: 'STUDENT' }, token(students))).status, 403);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.$disconnect();
  }
});
