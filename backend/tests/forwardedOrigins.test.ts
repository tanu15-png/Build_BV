import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

test('forwarded browser origins support canteen sign-in and portal logout without allowing the internal or other portal origin', async () => {
  const config = loadConfig({ DATABASE_URL: 'postgresql://localhost/test', FRONTEND_ORIGIN: 'http://localhost:5173',
    CANTEEN_ORIGIN: 'http://localhost:5175', ADMIN_ORIGIN: 'http://localhost:5176',
    ADMIN_ACCESS_PASSWORD: 'test-team-password', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), LOG_LEVEL: 'silent' });
  const db = {
    $queryRaw: async () => [{ count: 1 }],
    canteen: { findUnique: async () => ({ operational: true }) },
    canteenMembership: { findFirst: async () => null },
  } as unknown as PrismaClient;
  const server = createApp(config, db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  try {
    for (const portal of ['canteen'] as const) {
      const origin = config.CANTEEN_ORIGIN;
      const csrf = await fetch(`${base}/${portal}/auth/csrf`, { headers: { Origin: origin } });
      assert.equal(csrf.status, 200);
      const { csrfToken } = await csrf.json();
      const headers = { Origin: origin, Cookie: csrf.headers.getSetCookie()[0]!.split(';')[0]!,
        'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' };
      const path = '/auth/canteen/returning';
      const body = { email: 'member@example.edu', canteenId: 'f887dca4-c954-493a-a5db-dc511c49b149' };
      const response = await fetch(`${base}/${portal}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
      assert.equal((await response.json()).error.code, 'MEMBERSHIP_REQUIRED');
      const logout = await fetch(`${base}/${portal}/auth/logout`, { method: 'POST', headers, body: '{}' });
      assert.equal(logout.status, 200);
      assert.deepEqual(await logout.json(), { ok: true });
      for (const rejected of ['http://localhost:5174', config.FRONTEND_ORIGIN, 'https://evil.example',
        config.ADMIN_ORIGIN]) {
        const denied = await fetch(`${base}/${portal}/auth/logout`, { method: 'POST', headers: { ...headers, Origin: rejected }, body: '{}' });
        assert.equal(denied.status, 403);
        const { error } = await denied.json();
        assert.equal(error.code, 'ORIGIN_DENIED');
        assert(error.message.includes(origin), 'the error should direct the user to the configured browser address');
      }
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
