import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

test('reward deletion is staff-only, canteen-scoped and leaves menu and token history untouched', async () => {
  const config = loadConfig({ DATABASE_URL: 'postgresql://localhost/test', FRONTEND_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), LOG_LEVEL: 'silent' });
  const canteenId = randomUUID(), rewardId = randomUUID();
  let role = 'CANTEEN';
  const deletes: unknown[] = [];
  const db = {
    session: { findUnique: async () => ({ role, canteenId, revokedAt: null, expiresAt: new Date(Date.now()+60000), user: { id: randomUUID(), name: 'Staff', email: role === 'STUDENT' ? 'test@banasthali.in' : 'staff@example.edu', supabaseSubject: randomUUID(), status: 'ACTIVE', roles: [{ role }] }, membership: { status: 'ACTIVE', codeVersion: 1 }, canteen: { slug: 'canteen', accessCodes: [{ version: 1 }] } }) },
    $queryRaw: async () => [],
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
    reward: { deleteMany: async (query: unknown) => { deletes.push(query); return { count: 1 }; } },
    menuItem: { deleteMany: () => assert.fail('must not delete food') },
    order: { deleteMany: () => assert.fail('must not delete historical deductions') },
  } as unknown as PrismaClient;
  const server = createApp(config, db).listen(0, '127.0.0.1');
  await once(server, 'listening'); const address=server.address(); assert(address && typeof address !== 'string');
  async function remove(portal: 'student'|'canteen', id: string) {
    const base=`http://127.0.0.1:${(address as {port:number}).port}/api/v1/${portal}`;
    const origin=portal === 'student' ? config.FRONTEND_ORIGIN : config.CANTEEN_ORIGIN;
    const csrf=await fetch(base+'/auth/csrf', { headers: { Origin: origin } });
    const {csrfToken}=await csrf.json();
    return fetch(base+'/rewards/manage/'+id, { method: 'DELETE', headers: { Origin: origin, Cookie: `spoonate_${portal}_session=${'a'.repeat(64)}; ${csrf.headers.getSetCookie()[0]!.split(';')[0]}`, 'X-CSRF-Token': csrfToken } });
  }
  try {
    assert.equal((await remove('canteen',rewardId)).status,200);
    assert.deepEqual(deletes,[{where:{id:rewardId,canteenId}}]);
    assert.equal((await remove('canteen','invalid')).status,422);
    role='STUDENT';
    assert.equal((await remove('student',rewardId)).status,403);
    assert.equal(deletes.length,1);
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
