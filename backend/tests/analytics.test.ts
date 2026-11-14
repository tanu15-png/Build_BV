import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsRange } from '../src/services/analytics.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { once } from 'node:events';

test('sales periods use IST midnight and an exclusive end, including month/year boundaries', () => {
  const day = analyticsRange('day', '2026-11-14');
  assert.equal(day.start.toISOString(), '2026-11-13T18:30:00.000Z');
  assert.equal(day.end.toISOString(), '2026-11-14T18:30:00.000Z');
  assert.equal(analyticsRange('week', '2026-01-03').startDate, '2025-12-28');
  assert.equal(analyticsRange('month', '2024-02-29').startDate, '2024-02-01');
  for (const date of ['2026-02-30', '2026-13-01', 'bad', ['2026-01-01']]) assert.throws(() => analyticsRange('day', date));
  assert.throws(() => analyticsRange('year', '2026-11-14'));
});

test('stats require staff access and take their scope from the session, not query parameters', async () => {
  const canteenId = '11111111-1111-4111-8111-111111111111';
  let role = 'STUDENT', queried = false;
  const db = {
    session: { findUnique: async () => ({ role, canteenId, expiresAt: new Date(Date.now() + 60000), revokedAt: null,
      user: { id: 'staff', email: role === 'STUDENT' ? 'student@banasthali.in' : 'staff@example.com', name: 'Staff', status: 'ACTIVE', supabaseSubject: 'subject', roles: [{ role }] },
      canteen: { slug: 'canteen', accessCodes: [{ version: 1 }] }, membership: { status: 'ACTIVE', codeVersion: 1 } }) },
    $queryRaw: async (_sql: unknown, ...values: unknown[]) => {
      queried = true; assert.equal(values[0], canteenId);
      return [{ stats: { salesPaise: 9000, grossPaise: 10000, discountPaise: 1000, orders: 1, rewards: 1, quantity: 1, items: [], buckets: [] } }];
    },
  } as unknown as PrismaClient;
  const config = loadConfig({ DATABASE_URL: 'postgresql://local/test', FRONTEND_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test', APP_ENV: 'test', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), LOG_LEVEL: 'silent' });
  const server = createApp(config, db, () => {}).listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1/`;
  try {
    assert.equal((await fetch(base + 'canteen/stats?period=day&date=2026-11-14')).status, 401);
    assert.equal((await fetch(base + 'student/stats?period=day&date=2026-11-14', { headers: { Cookie: 'spoonate_student_session=' + 'a'.repeat(64) } })).status, 403);
    assert.equal(queried, false);
    role = 'CANTEEN';
    const headers = { Cookie: 'spoonate_canteen_session=' + 'a'.repeat(64) };
    assert.equal((await fetch(base + 'canteen/stats?period=day&date=2026-02-30', { headers })).status, 422);
    const response = await fetch(base + 'canteen/stats?period=day&date=2026-11-14&canteenId=foreign', { headers });
    assert.equal(response.status, 200); assert.equal((await response.json()).salesPaise, 9000);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
