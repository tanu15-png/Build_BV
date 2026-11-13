import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

for (const configured of [false, true]) {
  test(configured ? 'retired admin portal stays disabled with configured credentials' : 'retired admin portal stays disabled without credentials', async () => {
    const config = loadConfig({ DATABASE_URL: 'postgresql://localhost/test', FRONTEND_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), LOG_LEVEL: 'silent', ...(configured ? { ADMIN_ACCESS_PASSWORD: 'test-team-password' } : {}) });
    let attempts = 0;
    const db = { $queryRaw: async () => [{ count: ++attempts }], $transaction: () => assert.fail('rejected sign-ins must not create users or sessions') } as unknown as PrismaClient;
    const server = createApp(config, db, () => {}, (async () => { assert.fail('password-only admin access must not contact Supabase'); }) as typeof fetch).listen(0, '127.0.0.1');
    await once(server, 'listening'); const address = server.address(); assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api/v1/admin`;
    try {
      for (const path of ['/auth/csrf', '/auth/me', '/auth/admin/password', '/admin/summary']) {
        const response = await fetch(base + path, { headers: { Origin: config.ADMIN_ORIGIN } });
        assert.equal(response.status, 404);
        assert.equal(response.headers.getSetCookie().length, 0);
      }
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
}
