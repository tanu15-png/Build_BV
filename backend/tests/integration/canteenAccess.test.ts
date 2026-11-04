import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed, rotateCode } from '../../src/services/provision.js';
import { canteenMemberEmail } from '../../src/services/canteenAccess.js';
import { contracts } from '../../src/schemas/contracts.js';

const url = process.env.CANTEEN_ACCESS_TEST_DATABASE_URL;
test('name-and-code entry creates scoped canteen sessions without email or Supabase', { skip: !url }, async t => {
  assert(url); const parsed = new URL(url);
  assert(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname.includes('test'));
  assert.notEqual(url, process.env.DATABASE_URL);
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url }, encoding: 'utf8', timeout: 180000,
  });
  assert.equal(migration.status, 0, migration.stderr);
  const config = loadConfig({ DATABASE_URL: url, FRONTEND_ORIGIN: 'http://localhost:5173', ADMIN_ACCESS_PASSWORD: 'test-admin-password',
    SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SEED_DEVELOPMENT_DATA: 'true', DB_TIMEOUT_MS: '10000', LOG_LEVEL: 'silent' });
  const db = createPrisma(config); await seed(db, config);
  const canteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'bella-bite' } });
  const server = createApp(config, db, () => {}, (async () => assert.fail('name-and-code access must never contact Supabase')) as typeof fetch).listen(0, '127.0.0.1');
  await once(server, 'listening'); const address = server.address(); assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  class Browser {
    jar = new Map<string, string>(); csrf = '';
    constructor(readonly portal: 'canteen' | 'student' | 'admin' = 'canteen') {}
    async request(path: string, method = 'GET', body?: object, overrides = {}) {
      const origin = { canteen: config.CANTEEN_ORIGIN, student: config.FRONTEND_ORIGIN, admin: config.ADMIN_ORIGIN }[this.portal];
      const response = await fetch(`${base}/${this.portal}${path}`, { method, headers: { Origin: origin,
        Cookie: [...this.jar].map(([name, value]) => `${name}=${value}`).join('; '), 'X-CSRF-Token': this.csrf,
        'Content-Type': 'application/json', ...overrides }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const cookie of response.headers.getSetCookie()) {
        assert(cookie.includes(`Path=/api/v1/${this.portal}`)); assert(cookie.includes('HttpOnly'));
        const [name, value] = cookie.split(';')[0]!.split('='); this.jar.set(name!, value!);
      }
      return { status: response.status, body: await response.json() };
    }
    async prepare() { this.csrf = (await this.request('/auth/csrf')).body.csrfToken; return this; }
    login(name: string, accessCode: string) { return this.request('/auth/canteen/access', 'POST', { name, accessCode }); }
  }
  const staff = await new Browser().prepare();
  try {
    await t.test('the code selects the canteen and signs the named member in immediately', async () => {
      const response = await staff.login('  Tanu   Verma ', ' BELLA-BITE ');
      assert.equal(response.status, 200, JSON.stringify(response.body));
      contracts['POST /auth/canteen/access']!.response.parse(response.body);
      assert.equal(response.body.name, 'Tanu Verma'); assert.equal(response.body.canteenId, canteen.id);
      assert.equal((await staff.request('/auth/me')).body.id, response.body.id);
      const user = await db.user.findUniqueOrThrow({ where: { id: response.body.id } });
      assert.equal(user.supabaseSubject, null); assert.equal(user.emailVerifiedAt, null);
      assert.equal(await db.authChallenge.count(), 0);
      const members = await staff.request(`/canteens/${canteen.id}/members`);
      assert.equal(members.status, 200); assert.equal(members.body.items[0].name, 'Tanu Verma');
      assert.equal(members.body.signedInPeople, 1);
    });
    await t.test('repeated and concurrent sign-ins reuse the same canteen member', async () => {
      const second = await new Browser().prepare(); const third = await new Browser().prepare();
      const [a, b] = await Promise.all([second.login('tanu verma', 'bella-bite'), third.login('TANU VERMA', 'bella-bite')]);
      assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(a.body.id, b.body.id);
      assert.equal(await db.canteenMembership.count({ where: { canteenId: canteen.id } }), 1);
      const another = await new Browser().prepare(); const result = await another.login('Tanu Verma', 'shanu');
      assert.equal(result.status, 200); assert.notEqual(result.body.id, a.body.id); assert.notEqual(result.body.canteenId, canteen.id);
      assert.equal((await another.request(`/canteens/${canteen.id}/members`)).status, 403);
    });
    await t.test('wrong codes, email fields, caller-selected canteens, other portals and forged requests are rejected', async () => {
      const before = await db.user.count();
      assert.equal((await staff.login('Intruder', 'incorrect')).status, 401);
      assert.equal(await db.user.count(), before);
      for (const extra of [{ email: 'unused@example.edu' }, { canteenId: canteen.id }]) {
        assert.equal((await staff.request('/auth/canteen/access', 'POST', { name: 'Member', accessCode: 'bella-bite', ...extra })).status, 422);
      }
      for (const portal of ['student', 'admin'] as const) {
        assert.equal((await (await new Browser(portal).prepare()).login('Member', 'bella-bite')).status, 403);
      }
      assert.equal((await staff.request('/auth/canteen/access', 'POST', { name: 'Member', accessCode: 'bella-bite' }, { 'X-CSRF-Token': '' })).status, 403);
    });
    await t.test('removed and disabled members cannot sign in or keep using sessions', async () => {
      const removed = await new Browser().prepare(); const login = await removed.login('Removed Member', 'bella-bite'); assert.equal(login.status, 200);
      const member = await db.canteenMembership.findFirstOrThrow({ where: { userId: login.body.id, canteenId: canteen.id } });
      assert.equal((await staff.request(`/canteens/${canteen.id}/members/${member.id}/revoke`, 'POST', { expectedVersion: member.version })).status, 200);
      assert.equal((await removed.request('/auth/me')).status, 401);
      assert.equal((await removed.login('Removed Member', 'bella-bite')).status, 403);
      await db.user.update({ where: { id: login.body.id }, data: { status: 'DISABLED' } });
      assert.equal((await removed.login('Removed Member', 'bella-bite')).status, 403);
    });
    await t.test('rotation ends old sessions and permits the current code while preserving names', async () => {
      await rotateCode(db, config, 'bella-bite', 'Bella-Bite-New');
      assert.equal((await staff.request('/auth/me')).status, 401);
      assert.equal((await staff.login('Tanu Verma', 'bella-bite')).status, 401);
      const result = await staff.login('Tanu Verma', 'BELLA-BITE-NEW'); assert.equal(result.status, 200);
      assert.equal(result.body.email, canteenMemberEmail('Tanu Verma', canteen.id));
      await assert.rejects(rotateCode(db, config, 'shanu', 'bella-bite-new'), { status: 409 });
      await db.canteen.update({ where: { id: canteen.id }, data: { operational: false } });
      assert.equal((await staff.login('Another Member', 'bella-bite-new')).status, 403);
      await db.canteen.update({ where: { id: canteen.id }, data: { operational: true } });
    });
    await t.test('logout clears the canteen session and guessing codes is rate limited', async () => {
      assert.equal((await staff.request('/auth/logout', 'POST', {})).status, 200);
      assert.equal((await staff.request('/auth/me')).status, 401);
      await db.rateLimit.deleteMany();
      for (let i = 0; i < 21; i++) assert.equal((await staff.login('Guesser', 'incorrect')).status, i === 20 ? 429 : 401);
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
});
