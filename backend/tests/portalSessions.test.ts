import { adminTeamEmail } from '../src/services/adminTeam.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { portalOrigin, type Portal } from '../src/services/portal.js';

const portals = ['student', 'canteen'] as const;

test('student and Canteen sessions coexist, logout is isolated and retired staff sessions are blocked', async () => {
  const config = loadConfig({ DATABASE_URL: 'postgresql://localhost/test', FRONTEND_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_portal_test_12345', LOG_LEVEL: 'silent', ADMIN_ACCESS_PASSWORD: 'test-team-password' });
  const canteenId = randomUUID();
  const users = portals.map(portal => ({ id: randomUUID(), email: portal === 'student' ? 'student@banasthali.in' : `${portal}@example.edu`, supabaseSubject: randomUUID(), name: portal, status: 'ACTIVE', roles: [{ role: portal.toUpperCase() }] }));
  const teamUser = { id: randomUUID(), email: adminTeamEmail, supabaseSubject: null, name: 'Admin team', status: 'ACTIVE', roles: [{ role: 'ADMIN' }] };
  const membership = { id: randomUUID(), status: 'ACTIVE', codeVersion: 1 };
  const challenge = { id: randomUUID(), canteenId, purpose: 'CANTEEN_LOGIN', email: users[1]!.email, consumedAt: null as Date | null, expiresAt: new Date(Date.now() + 60000), createdAt: new Date(Date.now() - 1000), accessCodeVersion: 1 };
  type Row = { tokenHash: string; userId: string; role: string; revokedAt?: Date | null; expiresAt: Date; canteenId?: string | null };
  const sessions = new Map<string, Row>();
  const sessionModel = {
    create: async ({ data }: { data: Row }) => { sessions.set(data.tokenHash, data); return data; },
    findUnique: async ({ where }: { where: { tokenHash: string } }) => {
      const row = sessions.get(where.tokenHash);
      return row ? { ...row, user: row.userId === teamUser.id ? teamUser : users.find(user => user.id === row.userId), membership, canteen: { slug: 'canteen', accessCodes: [{ version: 1 }] } } : null;
    },
    updateMany: async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
      let count = 0;
      for (const row of sessions.values()) if (Object.entries(where).every(([key, value]) => (row[key as keyof Row] ?? null) === value)) { Object.assign(row, data); count++; }
      return { count };
    },
  };
  const db = {
    $queryRaw: async () => [{ count: 1 }],
    $executeRaw: async () => 1,
    $transaction: async (run: (tx: unknown) => unknown) => run(db),
    session: sessionModel,
    order: {
      findFirst: async () => ({ id: canteenId, studentId: users[0]!.id, canteenId, canteen: { name: 'Test canteen' }, student: { name: 'Private customer name' }, status: 'READY', executionMode: 'TEST', paymentStatus: 'NOT_REQUIRED_TEST', totalPaise: 100, pickupAt: new Date(), codeDay: new Date(), orderCode: 'ABC', version: 1, createdAt: new Date(), collectedAt: null, pickupVerifiedBy: null, items: [], events: [] }),
    },
    auditLog: { create: async () => ({}) },
    user: {
      upsert: async () => teamUser,
      findUnique: async ({ where }: { where: { email: string } }) => users.find(user => user.email === where.email),
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => users.find(user => user.id === where.id),
    },
    userRole: { upsert: async () => ({}) },
    canteen: { findUniqueOrThrow: async () => ({ operational: true }) },
    canteenAccessCode: { findFirst: async () => ({ version: 1 }) },
    canteenMembership: { findUnique: async () => membership, upsert: async () => membership },
    authChallenge: { findUnique: async () => challenge, findUniqueOrThrow: async () => challenge, update: async ({ data }: { data: Partial<typeof challenge> }) => Object.assign(challenge, data) },
  } as unknown as PrismaClient;
  const tokens = new Map<string, typeof users[number]>();
  const proof = (portal: Portal) => {
    const user = users[portals.findIndex(value => value === portal)]!;
    const token = `e30.${Buffer.from(JSON.stringify({ sub: user.supabaseSubject, amr: [{ method: portal === 'canteen' ? 'otp' : 'password', timestamp: Math.floor(Date.now() / 1000) }] })).toString('base64url')}.signature`;
    tokens.set(token, user); return token;
  };
  let authCalls = 0;
  const authFetch = (async (_url, init) => {
    authCalls++;
    if (String(_url).endsWith('/verify')) return Response.json({ access_token: proof('student') });
    const user = tokens.get((init?.headers as Record<string, string>).Authorization.slice(7));
    return user ? Response.json({ id: user.supabaseSubject, email: user.email, email_confirmed_at: new Date().toISOString() }) : new Response('{}', { status: 401 });
  }) as typeof fetch;
  const server = createApp(config, db, () => {}, authFetch).listen(0, '127.0.0.1');
  await once(server, 'listening'); const address = server.address(); assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  // Send every cookie to every portal, stronger than a real browser's path filtering.
  const jar = new Map<string, string>(); const csrf = new Map<Portal, string>();
  async function request(portal: Portal, path: string, method = 'GET', body?: object, token?: string, overrides: Record<string, string> = {}) {
    const response = await fetch(`${base}/api/v1/${portal}${path}`, { method, headers: {
      Origin: portalOrigin(config, portal), Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
      'Content-Type': 'application/json', 'X-CSRF-Token': csrf.get(portal) || '', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...overrides,
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    for (const cookie of response.headers.getSetCookie()) {
      assert(cookie.includes(`Path=/api/v1/${portal}`)); assert(cookie.includes('HttpOnly')); assert(!cookie.includes('Domain='));
      const [name, value] = cookie.split(';')[0]!.split('='); jar.set(name!, value!);
    }
    return { response, body: await response.json() };
  }
  const hash = (value: string) => createHmac('sha256', config.SESSION_SECRET).update(`session:${value}`).digest('hex');
  try {
    for (const portal of portals) {
      csrf.set(portal, (await request(portal, '/auth/csrf')).body.csrfToken);
      const login = await request(portal, '/auth/session', 'POST', { role: portal.toUpperCase(), ...(portal === 'canteen' ? { challengeId: challenge.id } : {}) }, proof(portal));
      assert.equal(login.response.status, 200, JSON.stringify(login.body));
      assert.equal((await request(portal, '/auth/me')).body.role, portal.toUpperCase());
    }
    assert.equal((await request('admin', '/auth/me')).response.status, 404);
    const staffOrder = await request('canteen', `/orders/${canteenId}`);
    assert.equal(staffOrder.response.status, 200);
    assert(!('studentName' in staffOrder.body));
    const oldStudent = jar.get('spoonate_student_session')!;
    assert.equal((await request('student', '/auth/session', 'POST', { role: 'STUDENT' }, proof('student'))).response.status, 200);
    assert(sessions.get(hash(oldStudent))!.revokedAt);
    assert.equal((await request('canteen', '/auth/me')).body.role, 'CANTEEN');
    assert.equal((await request('student', '/auth/logout', 'POST', {})).response.status, 200);
    assert.equal((await request('student', '/auth/me')).response.status, 401);
    assert.equal((await request('canteen', '/auth/me')).body.role, 'CANTEEN');
    assert.equal((await request('canteen', '/auth/logout', 'POST', {})).response.status, 200);
    assert.equal((await request('canteen', '/auth/me')).response.status, 401);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
