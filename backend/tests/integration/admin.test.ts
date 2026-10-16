import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed } from '../../src/services/provision.js';
import { verifySecret } from '../../src/services/hash.js';
import { contracts } from '../../src/schemas/contracts.js';
import type { Role, OrderStatus, Order } from '../../src/generated/prisma/client.js';
const url = process.env.ADMIN_TEST_DATABASE_URL;
test('admin oversight, campus aggregates and audited maintenance', { skip: !url }, async t => {
  assert(url); const address = new URL(url);
  assert(['localhost', '127.0.0.1'].includes(address.hostname) && address.pathname.includes('test'));
  assert.notEqual(url, process.env.DATABASE_URL);
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url }, encoding: 'utf8', timeout: 180000 });
  assert.equal(migration.status, 0, migration.stderr);
  const config = loadConfig({ DATABASE_URL: url, APP_ENV: 'test', NODE_ENV: 'test', FRONTEND_ORIGIN: 'http://localhost:5173',
    SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SEED_DEVELOPMENT_DATA: 'true', LOG_LEVEL: 'silent', DB_TIMEOUT_MS: '10000', SUPABASE_URL: 'https://admin-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_test_123456' });
  const db = createPrisma(config); await seed(db, config);
  const canteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'bella-bite' } });
  const identities = new Map<string, object>();
  const authFetch = (async (_target, init) => {
    const token = (init?.headers as Record<string, string>).Authorization?.slice(7);
    return identities.has(token) ? Response.json(identities.get(token)) : new Response('{}', { status: 401 });
  }) as typeof fetch;
  const server = createApp(config, db, () => {}, authFetch).listen(0, '127.0.0.1');
  await once(server, 'listening'); const port = server.address(); assert(port && typeof port !== 'string');
  const base = `http://127.0.0.1:${port.port}/api/v1`;
  class Browser {
    jar = new Map<string, string>(); csrf = '';
    constructor(readonly target = base) {}
    async request(path: string, method = 'GET', body?: object, key?: string, proof?: string) {
      const response = await fetch(this.target + path, { method, headers: { Origin: config.FRONTEND_ORIGIN,
        Cookie: [...this.jar].map(([name, value]) => `${name}=${value}`).join('; '),
        ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}), ...(proof ? { Authorization: `Bearer ${proof}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0]!.split('='); this.jar.set(name!, value!); }
      return { status: response.status, body: await response.json(), headers: response.headers };
    }
    async prepare() { this.csrf = (await this.request('/auth/csrf')).body.csrfToken; return this; }
  }
  async function fixture(role: Role, email: string, canteenId?: string) {
    const user = await db.user.create({ data: { email, name: 'Admin Test', supabaseSubject: randomUUID(), emailVerifiedAt: new Date(), roles: { create: { role } } } });
    const membership = canteenId ? await db.canteenMembership.create({ data: { userId: user.id, canteenId, codeVersion: 1 } }) : null;
    const token = randomBytes(32).toString('hex');
    const session = await db.session.create({ data: { userId: user.id, role, canteenId, membershipId: membership?.id,
      tokenHash: createHmac('sha256', config.SESSION_SECRET).update(`session:${token}`).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    const browser = await new Browser().prepare(); browser.jar.set('spoonate_session', token);
    return { user, session, browser, membership };
  }
  const student = await fixture('STUDENT', 'admin-student@banasthali.in');
  const second = await fixture('STUDENT', 'admin-second@banasthali.in');
  const staff = await fixture('CANTEEN', 'admin-staff@example.edu', canteen.id);
  const otherCanteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'shanu' } });
  const otherStaff = await fixture('CANTEEN', 'admin-other-staff@example.edu', otherCanteen.id);
  const admin = await fixture('ADMIN', 'admin-test@example.edu');
  function proof(user: typeof student.user, method = 'password') {
    const token = `e30.${Buffer.from(JSON.stringify({ sub: user.supabaseSubject, amr: [{ method, timestamp: Math.floor(Date.now() / 1000) }], nonce: randomUUID() })).toString('base64url')}.signature`;
    identities.set(token, { id: user.supabaseSubject, email: user.email, email_confirmed_at: new Date().toISOString() }); return token;
  }
  const safe = (value: unknown) => {
    const text = JSON.stringify(value);
    for (const field of ['passwordHash', 'supabaseSubject', 'codeHash', 'otpHash', 'tokenHash', 'encryptedCode', 'pickupCredential']) assert(!text.includes(`"${field}"`), field);
  };
  const items = await db.menuItem.findMany({ orderBy: { id: 'asc' } });
  const menu = items.find(row => row.canteenId === canteen.id)!;
  const seeded: Order[] = [];
  for (let index = 0; index < 107; index++) {
    const collected = index < 3;
    const status: OrderStatus = collected ? 'COLLECTED' : index % 2 ? 'READY' : 'RECEIVED';
    seeded.push(await db.order.create({ data: { studentId: index % 2 ? second.user.id : student.user.id,
      canteenId: index % 3 ? canteen.id : otherCanteen.id, totalPaise: collected ? 1000000000 : 1000,
      status, pickupAt: new Date('2026-10-16T12:00:00Z'), codeDay: new Date(index === 106 ? '2026-10-17' : '2026-10-16'),
      orderCode: index === 106 ? '000' : index.toString(36).toUpperCase().padStart(3, '0'), createdAt: new Date(index === 106 ? '2026-10-17T10:00:00Z' : '2026-10-16T10:00:00Z'),
      ...(collected ? { collectedAt: new Date('2026-10-16T11:00:00Z'), pickupVerifiedBy: staff.user.id } : {}),
      items: { create: { menuItemId: menu.id, name: index % 2 ? 'Historical Tea' : 'Historical Noodles', quantity: 1, unitPricePaise: collected ? 1000000000 : 1000 } },
    } }));
  }
  try {
    await t.test('admin endpoints and maintenance reject anonymous, student and canteen sessions', async () => {
      const anonymous = await new Browser().prepare();
      for (const endpoint of ['/admin/overview', '/admin/orders', '/admin/users', '/admin/memberships']) {
        assert.equal((await anonymous.request(endpoint)).status, 401);
        for (const browser of [student.browser, staff.browser, otherStaff.browser]) assert.equal((await browser.request(endpoint)).status, 403);
      }
      for (const browser of [student.browser, staff.browser]) {
        assert.equal((await browser.request(`/admin/canteens/${canteen.id}`, 'PATCH', { expectedVersion: 1, name: 'Denied' })).status, 403);
        assert.equal((await browser.request(`/admin/users/${second.user.id}`, 'PATCH', { status: 'DISABLED' })).status, 403);
        assert.equal((await browser.request(`/admin/memberships/${staff.membership!.id}`, 'PATCH', { status: 'REVOKED', expectedVersion: 1 })).status, 403);
        assert.equal((await browser.request(`/admin/canteens/${canteen.id}/access-code`, 'POST', { accessCode: 'unauthorized secure phrase' })).status, 403);
      }
      assert.equal((await student.browser.request(`/canteens/${otherCanteen.id}/menu/manage`)).status, 403);
      assert.equal((await staff.browser.request(`/canteens/${otherCanteen.id}/menu/manage`)).status, 403);
    });
    await t.test('campus summaries include all pages, retain large test values and match PostgreSQL totals', async () => {
      const result = await admin.browser.request('/admin/overview'); assert.equal(result.status, 200);
      contracts['GET /admin/overview']!.response.parse(result.body); safe(result.body);
      assert.equal(result.body.totalOrders, 107); assert.equal(result.body.activeOrders, 104); assert.equal(result.body.collectedOrders, 3);
      assert.equal(result.body.collectedValuePaise, 3000000000); assert.equal(result.body.totalCanteens, 8);
      assert.equal(result.body.canteens.reduce((sum: number, row: { totalOrders: number }) => sum + row.totalOrders, 0), 107);
      const empty = result.body.canteens.find((row: { id: string }) => row.id !== canteen.id && row.id !== otherCanteen.id);
      assert.equal(empty.totalOrders, 0); assert(empty.menuItemCount > 0);
      const filtered = await admin.browser.request('/admin/orders?status=COLLECTED&limit=1'); assert.equal(filtered.body.items.length, 1); assert.equal(filtered.body.totalCount, 3);
      assert.equal((await admin.browser.request('/admin/overview')).body.totalOrders, 107);
      assert(!('revenue' in result.body));
    });
    await t.test('order pagination is stable for tied timestamps and all server filters compose', async () => {
      const seen = new Set<string>(); let cursor: string | null = null;
      do {
        const response = await admin.browser.request('/admin/orders?limit=17' + (cursor ? `&cursor=${cursor}` : ''));
        assert.equal(response.status, 200); contracts['GET /admin/orders']!.response.parse(response.body); safe(response.body);
        assert.equal(response.body.totalCount, 107);
        for (const row of response.body.items) { assert(!seen.has(row.id)); seen.add(row.id); }
        cursor = response.body.nextCursor;
      } while (cursor);
      assert.equal(seen.size, 107);
      const q = new URLSearchParams({ canteenId: canteen.id, status: 'READY', search: 'tea', codeDay: '2026-10-16', from: '2026-10-16T09:00:00Z', to: '2026-10-16T10:00:00Z' });
      const matching = await admin.browser.request('/admin/orders?' + q); assert.equal(matching.status, 200); assert(matching.body.items.length > 0);
      assert(matching.body.items.every((row: { canteenId: string; status: string }) => row.canteenId === canteen.id && row.status === 'READY'));
      const dayOne = await admin.browser.request('/admin/orders?orderCode=000&codeDay=2026-10-16');
      const dayTwo = await admin.browser.request('/admin/orders?orderCode=000&codeDay=2026-10-17');
      assert.equal(dayOne.body.totalCount, 1); assert.equal(dayTwo.body.totalCount, 1); assert.notEqual(dayOne.body.items[0].id, dayTwo.body.items[0].id);
      assert.equal((await admin.browser.request('/admin/orders?search=2026-10-17')).body.totalCount, 1);
      assert.equal((await admin.browser.request('/admin/orders?from=2026-10-17T00:00:00Z&to=2026-10-16T00:00:00Z')).status, 422);
      assert.equal((await admin.browser.request('/admin/orders?limit=101')).status, 422);
      assert.equal((await admin.browser.request(`/admin/orders?canteenId=${canteen.id}&cursor=${seeded[0]!.id}`)).status, 422);
    });
    await t.test('accounts and memberships paginate safely without credentials or source authentication metadata', async () => {
      const accounts = await admin.browser.request('/admin/users?role=STUDENT&search=admin-&limit=1');
      assert.equal(accounts.status, 200); contracts['GET /admin/users']!.response.parse(accounts.body); safe(accounts.body); assert(accounts.body.nextCursor);
      assert.equal((await admin.browser.request(`/admin/users?role=STUDENT&search=admin-&limit=1&cursor=${accounts.body.nextCursor}`)).body.items.length, 1);
      const members = await admin.browser.request('/admin/memberships?limit=1'); assert.equal(members.status, 200); contracts['GET /admin/memberships']!.response.parse(members.body); safe(members.body); assert(members.body.nextCursor);
      assert.equal((await admin.browser.request(`/admin/memberships?canteenId=${canteen.id}`)).body.items[0].email, staff.user.email);
      const noCsrf = new Browser(); noCsrf.jar = new Map(admin.browser.jar);
      assert.equal((await noCsrf.request(`/admin/users/${student.user.id}`, 'PATCH', { status: 'DISABLED' })).status, 403);
    });
    await t.test('account disable/enable is audited, revokes sessions, rejects stale edits and retains history', async () => {
      const before = await db.order.count(); const user = await db.user.findUniqueOrThrow({ where: { id: student.user.id } });
      const disabled = await admin.browser.request(`/admin/users/${user.id}`, 'PATCH', { status: 'DISABLED', expectedUpdatedAt: user.updatedAt.toISOString() }); assert.equal(disabled.status, 200);
      assert.equal((await student.browser.request('/auth/me')).status, 401);
      assert.equal(await db.session.count({ where: { userId: user.id, revokedAt: null } }), 0);
      assert.equal(await db.order.count(), before); assert.equal(await db.auditLog.count({ where: { action: 'ACCOUNT_DISABLED', target: user.id } }), 1);
      assert.equal((await admin.browser.request(`/admin/users/${user.id}`, 'PATCH', { status: 'ACTIVE', expectedUpdatedAt: user.updatedAt.toISOString() })).status, 409);
      assert.equal((await admin.browser.request(`/admin/users/${user.id}`, 'PATCH', { status: 'ACTIVE' })).status, 200);
      assert.equal((await student.browser.request('/auth/session', 'POST', { role: 'STUDENT' }, undefined, proof(student.user))).status, 200);
      assert.equal((await admin.browser.request(`/admin/users/${admin.user.id}`, 'PATCH', { status: 'DISABLED' })).body.error.code, 'SELF_DISABLE_DENIED');
    });
    await t.test('concurrent login and disabling cannot leave a surviving session or erase order history', async () => {
      const before = await db.order.count({ where: { studentId: second.user.id } });
      const [disabled, login] = await Promise.all([
        admin.browser.request(`/admin/users/${second.user.id}`, 'PATCH', { status: 'DISABLED' }),
        second.browser.request('/auth/session', 'POST', { role: 'STUDENT' }, undefined, proof(second.user)),
      ]);
      assert.equal(disabled.status, 200); assert([200, 403].includes(login.status));
      assert.equal(await db.session.count({ where: { userId: second.user.id, revokedAt: null } }), 0);
      assert.equal(await db.order.count({ where: { studentId: second.user.id } }), before);
      assert.equal((await admin.browser.request(`/admin/users/${second.user.id}`, 'PATCH', { status: 'ACTIVE' })).status, 200);
    });
    await t.test('simultaneous administrators cannot disable each other and leave no active administrator', async () => {
      const a = await fixture('ADMIN', 'admin-pair-a@example.edu'); const b = await fixture('ADMIN', 'admin-pair-b@example.edu');
      const result = await Promise.all([a.browser.request(`/admin/users/${b.user.id}`, 'PATCH', { status: 'DISABLED' }), b.browser.request(`/admin/users/${a.user.id}`, 'PATCH', { status: 'DISABLED' })]);
      assert.deepEqual(result.map(row => row.status).sort(), [200, 401]);
      assert.equal(await db.user.count({ where: { id: { in: [a.user.id, b.user.id] }, status: 'ACTIVE' } }), 1);
    });
    await t.test('membership revocation/restoration is versioned, scoped and audited without restoring old sessions', async () => {
      const member = staff.membership!;
      const before = await db.order.count();
      assert.equal((await admin.browser.request(`/admin/memberships/${member.id}`, 'PATCH', { status: 'REVOKED', expectedVersion: member.version })).status, 200);
      assert.equal((await staff.browser.request('/auth/me')).status, 401); assert.equal((await otherStaff.browser.request('/auth/me')).status, 200);
      assert.equal((await admin.browser.request(`/admin/memberships/${member.id}`, 'PATCH', { status: 'ACTIVE', expectedVersion: member.version })).status, 409);
      assert.equal((await admin.browser.request(`/admin/users/${staff.user.id}`, 'PATCH', { status: 'DISABLED' })).status, 200);
      assert.equal((await admin.browser.request(`/admin/memberships/${member.id}`, 'PATCH', { status: 'ACTIVE', expectedVersion: member.version + 1 })).status, 409);
      await admin.browser.request(`/admin/users/${staff.user.id}`, 'PATCH', { status: 'ACTIVE' });
      assert.equal((await admin.browser.request(`/admin/memberships/${member.id}`, 'PATCH', { status: 'ACTIVE', expectedVersion: member.version + 1 })).status, 200);
      assert.equal((await staff.browser.request('/auth/me')).status, 401);
      const start = await staff.browser.request('/auth/canteen/returning', 'POST', { email: staff.user.email, canteenId: canteen.id }); assert.equal(start.status, 200);
      assert.equal((await staff.browser.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: start.body.challengeId }, undefined, proof(staff.user, 'otp'))).status, 200);
      assert.equal(await db.order.count(), before);
      assert.equal(await db.auditLog.count({ where: { action: 'MEMBERSHIP_RESTORED', target: member.id } }), 1);
    });
    await t.test('canteen disabling blocks new orders/sign-ins, consumes challenges and preserves existing fulfillment', async () => {
      const pending = await staff.browser.request('/auth/canteen/returning', 'POST', { email: staff.user.email, canteenId: canteen.id }); assert.equal(pending.status, 200);
      const ready = seeded.find(row => row.status === 'READY' && row.canteenId === canteen.id && row.studentId === student.user.id) ?? await db.order.create({ data: { studentId: student.user.id, canteenId: canteen.id, status: 'READY', totalPaise: 1000, pickupAt: new Date(), codeDay: new Date('2026-10-18'), orderCode: 'A01' } });
      const code = (await student.browser.request(`/orders/${ready.id}/pickup-code`)).body.code;
      const current = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      const disabled = await admin.browser.request(`/admin/canteens/${canteen.id}`, 'PATCH', { expectedVersion: current.version, operational: false }); assert.equal(disabled.status, 200); assert.equal(disabled.body.acceptingOrders, false);
      assert.equal((await staff.browser.request('/auth/canteen/returning', 'POST', { email: staff.user.email, canteenId: canteen.id })).status, 403);
      assert.equal((await staff.browser.request('/auth/canteen/login', 'POST', { email: staff.user.email, canteenId: canteen.id, accessCode: 'Bella Bite' })).status, 403);
      assert.equal((await staff.browser.request('/auth/session', 'POST', { role: 'CANTEEN', challengeId: pending.body.challengeId }, undefined, proof(staff.user, 'otp'))).status, 403);
      const cart = (await student.browser.request('/cart')).body;
      assert.equal((await student.browser.request('/cart/items', 'POST', { expectedVersion: cart.version, menuItemId: menu.id, quantity: 1 })).status, 409);
      assert.equal((await staff.browser.request('/auth/me')).status, 200);
      assert.equal((await staff.browser.request(`/orders/${ready.id}/collect`, 'POST', { expectedVersion: ready.version, code }, randomUUID())).status, 200);
      assert.equal((await admin.browser.request(`/admin/canteens/${canteen.id}`, 'PATCH', { expectedVersion: current.version, operational: true })).status, 409);
      const enabled = await admin.browser.request(`/admin/canteens/${canteen.id}`, 'PATCH', { expectedVersion: disabled.body.version, operational: true, acceptingOrders: true, hours: '9 AM–8 PM' }); assert.equal(enabled.status, 200);
      assert.equal(await db.order.count({ where: { id: ready.id, status: 'COLLECTED' } }), 1);
    });
    await t.test('admin menu maintenance uses the shared workflow, audits writes and preserves historical item snapshots', async () => {
      assert.equal((await admin.browser.request(`/canteens/${canteen.id}/menu/manage`)).status, 200);
      const category = await admin.browser.request(`/canteens/${canteen.id}/categories`, 'POST', { name: 'Admin specials' }); assert.equal(category.status, 201);
      const added = await admin.browser.request(`/canteens/${canteen.id}/menu`, 'POST', { name: 'Admin Soup', categoryId: category.body.id, pricePaise: 5000 }); assert.equal(added.status, 201);
      assert.equal((await admin.browser.request(`/menu-items/${added.body.id}`, 'PATCH', { expectedVersion: 1, pricePaise: 5500 })).status, 200);
      assert.equal((await staff.browser.request(`/menu-items/${items.find(row => row.canteenId === otherCanteen.id)!.id}`, 'PATCH', { expectedVersion: 1, available: false })).status, 403);
      const historical = seeded[0]!;
      const snapshot = await db.orderItem.findFirstOrThrow({ where: { orderId: historical.id } });
      assert.equal((await admin.browser.request(`/menu-items/${menu.id}`, 'DELETE', { expectedVersion: menu.version })).status, 200);
      assert.deepEqual(await db.orderItem.findUniqueOrThrow({ where: { id: snapshot.id } }), { ...snapshot, menuItemId: null });
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: historical.id } })).totalPaise, historical.totalPaise);
      assert.equal(await db.auditLog.count({ where: { actorId: admin.user.id, action: 'ADMIN_MENU_DELETED' } }), 1);
      assert.equal((await admin.browser.request(`/menu-items/${added.body.id}`, 'PATCH', { expectedVersion: 2, archived: true })).status, 200);
      assert.equal((await admin.browser.request(`/menu-categories/${category.body.id}`, 'PATCH', { expectedVersion: 1, archived: true })).status, 200);
    });
    await t.test('audit failures roll back admin catalog and directory writes', async () => {
      const current = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      await db.$executeRawUnsafe("CREATE FUNCTION phase11_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'ADMIN_%' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$");
      await db.$executeRawUnsafe('CREATE TRIGGER phase11_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION phase11_audit_failure()');
      try {
        assert.equal((await admin.browser.request(`/admin/canteens/${canteen.id}`, 'PATCH', { expectedVersion: current.version, name: 'Should roll back' })).status, 500);
        assert.equal((await admin.browser.request(`/canteens/${canteen.id}/categories`, 'POST', { name: 'Must roll back' })).status, 500);
      } finally { await db.$executeRawUnsafe('DROP TRIGGER phase11_audit_failure ON audit_logs'); await db.$executeRawUnsafe('DROP FUNCTION phase11_audit_failure()'); }
      assert.equal((await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } })).name, current.name);
      assert.equal(await db.menuCategory.count({ where: { canteenId: canteen.id, name: 'Must roll back' } }), 0);
    });
    await t.test('join-code rotation is audited, exposes no secret, rejects stale repeats and ends scoped sessions/challenges', async () => {
      const challenge = await staff.browser.request('/auth/canteen/returning', 'POST', { email: staff.user.email, canteenId: canteen.id }); assert.equal(challenge.status, 200);
      const before = await db.order.count(); const newCode = 'phase11 new secret join phrase';
      const result = await admin.browser.request(`/admin/canteens/${canteen.id}/access-code`, 'POST', { accessCode: newCode, expectedCodeVersion: 1 }); assert.equal(result.status, 200); assert.deepEqual(result.body, { ok: true });
      const saved = await db.canteenAccessCode.findFirstOrThrow({ where: { canteenId: canteen.id, active: true } });
      assert.equal(saved.version, 2); assert.equal(saved.rotatedBy, admin.user.id); assert(await verifySecret(newCode, saved.codeHash));
      assert.equal((await staff.browser.request('/auth/me')).status, 401); assert.equal((await otherStaff.browser.request('/auth/me')).status, 200);
      assert((await db.authChallenge.findUniqueOrThrow({ where: { id: challenge.body.challengeId } })).consumedAt);
      assert.equal((await admin.browser.request(`/admin/canteens/${canteen.id}/access-code`, 'POST', { accessCode: 'stale new secret phrase', expectedCodeVersion: 1 })).status, 409);
      assert.equal(await db.canteenAccessCode.count({ where: { canteenId: canteen.id, active: true } }), 1);
      const overview = await admin.browser.request('/admin/overview'); safe(overview.body); assert(!JSON.stringify(overview.body).includes(newCode));
      assert.equal(overview.body.canteens.find((row: { id: string }) => row.id === canteen.id).activeCodeVersion, 2);
      assert.equal(await db.order.count(), before);
    });
    await t.test('admin oversight never permits staff fulfillment, collection, private pickup retrieval or history deletion', async () => {
      const order = seeded.find(row => row.status === 'READY')!;
      assert.equal((await admin.browser.request(`/orders/${order.id}/accept`, 'POST', { expectedVersion: order.version }, randomUUID())).status, 403);
      assert.equal((await admin.browser.request(`/orders/${order.id}/collect`, 'POST', { expectedVersion: order.version, code: '42' }, randomUUID())).status, 403);
      assert.equal((await admin.browser.request(`/orders/${order.id}/pickup-code`)).status, 403);
      assert.equal((await admin.browser.request(`/admin/orders/${order.id}`, 'DELETE', {})).status, 404);
      const expected = await db.order.count(); assert.equal((await admin.browser.request('/admin/overview')).body.totalOrders, expected);
    });
    await t.test('application-role RLS supports admin reads and audited directory updates; expired admins are denied', async () => {
      const role = 'phase11_app_' + randomBytes(6).toString('hex'); await db.$executeRawUnsafe(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS`);
      const grants = spawnSync('psql', ['-h', address.hostname, '-p', address.port || '5432', '-U', decodeURIComponent(address.username), '-d', address.pathname.slice(1), '-v', `app_role=${role}`, '-f', 'prisma/application-role.sql'], { env: { ...process.env, PGPASSWORD: decodeURIComponent(address.password) }, encoding: 'utf8', timeout: 30000 }); assert.equal(grants.status, 0, grants.stderr);
      const appUrl = new URL(url); appUrl.username = role; appUrl.password = ''; const appDb = createPrisma({ ...config, DATABASE_URL: appUrl.toString() });
      const appServer = createApp(config, appDb, () => {}, authFetch).listen(0, '127.0.0.1'); await once(appServer, 'listening'); const appAddress = appServer.address(); assert(appAddress && typeof appAddress !== 'string');
      const device = new Browser(`http://127.0.0.1:${appAddress.port}/api/v1`); device.jar = new Map(admin.browser.jar); device.csrf = admin.browser.csrf;
      try {
        assert.equal((await device.request('/admin/overview')).status, 200); assert.equal((await device.request('/admin/users')).status, 200);
        assert.equal((await device.request('/admin/orders')).status, 200); assert.equal((await device.request('/admin/memberships')).status, 200);
        const current = await db.canteen.findUniqueOrThrow({ where: { id: otherCanteen.id } });
        assert.equal((await device.request(`/admin/canteens/${current.id}`, 'PATCH', { expectedVersion: current.version, hours: '10 AM–7 PM' })).status, 200);
        await db.session.update({ where: { id: admin.session.id }, data: { createdAt: new Date(Date.now() - 120000), expiresAt: new Date(Date.now() - 60000) } });
        assert.equal((await device.request('/admin/overview')).status, 401);
        assert.equal((await device.request(`/admin/users/${student.user.id}`, 'PATCH', { status: 'DISABLED' })).status, 401);
      } finally { await new Promise<void>(resolve => appServer.close(() => resolve())); await appDb.$disconnect(); }
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
});
