import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { loadConfig } from '../config/env.js';
import { createPrisma } from '../lib/prisma.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { hashSecret } from '../services/hash.js';
import { cartSchema, orderSchema } from '../schemas/contracts.js';
async function main() {
  const config = loadConfig();
  const db = createPrisma(config);
  const rollback = new Error('qualification rollback');
  const canteenId = randomUUID();
  let stage = 'configuration';
  const started = Date.now();
  const progress = () => console.log('CHECK: ' + stage + ' (' + (Date.now() - started) + 'ms)');
  try {
    try {
      await db.$transaction(async tx => {
        stage = 'temporary database fixtures'; progress();
        const canteen = await tx.canteen.create({ data: { id: canteenId, slug: 'check-' + canteenId, name: 'Qualification probe' } });
        await tx.canteenAccessCode.create({ data: { canteenId, version: 1, codeHash: await hashSecret(randomBytes(32).toString('hex')) } });
        const category = await tx.menuCategory.create({ data: { canteenId, name: 'Qualification probe' } });
        const item = await tx.menuItem.create({ data: { canteenId, categoryId: category.id, name: 'Qualification probe', pricePaise: 1 } });
        const student = await tx.user.create({ data: { email: 'probe-' + randomUUID() + '@banasthali.in', name: 'Qualification student', supabaseSubject: randomUUID(), emailVerifiedAt: new Date(), roles: { create: { role: 'STUDENT' } } } });
        const staff = await tx.user.create({ data: { email: 'probe-' + randomUUID() + '@example.invalid', name: 'Qualification staff', supabaseSubject: randomUUID(), emailVerifiedAt: new Date(), roles: { create: { role: 'CANTEEN' } } } });
        const membership = await tx.canteenMembership.create({ data: { userId: staff.id, canteenId, codeVersion: 1 } });
        const studentToken = randomBytes(32).toString('hex'); const staffToken = randomBytes(32).toString('hex');
        for (const [userId, role, token] of [[student.id, 'STUDENT', studentToken], [staff.id, 'CANTEEN', staffToken]] as const) {
          await tx.session.create({ data: { userId, role, tokenHash: createHmac('sha256', config.SESSION_SECRET).update('session:' + token).digest('hex'),
            ...(role === 'CANTEEN' ? { canteenId, membershipId: membership.id } : {}), expiresAt: new Date(Date.now() + 3600000) } });
        }
        // This probe shares one outer transaction so every fixture and API write is rolled back.
        const scoped = new Proxy(tx, { get(target, property, receiver) {
          if (property === '$transaction') return async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx);
          return Reflect.get(target, property, receiver);
        } }) as unknown as PrismaClient;
        const server = createApp({ ...config, LOG_LEVEL: 'silent' }, scoped, () => {}).listen(0, '127.0.0.1');
        await once(server, 'listening'); const address = server.address(); assert(address && typeof address !== 'string');
        const base = 'http://127.0.0.1:' + address.port + '/api/v1';
        let csrf = ''; let csrfCookie = '';
        async function request(path: string, token: string, method = 'GET', body?: object, key?: string) {
          const response = await fetch(base + path, { method, signal: AbortSignal.timeout(40000), headers: {
            Cookie: 'spoonate_session=' + token + (csrfCookie ? '; ' + csrfCookie : ''), Origin: config.FRONTEND_ORIGIN,
            ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}), ...(key ? { 'Idempotency-Key': key } : {}),
          }, ...(body ? { body: JSON.stringify(body) } : {}) });
          const data = await response.json();
          if (path === '/auth/csrf') { csrf = data.csrfToken; csrfCookie = response.headers.getSetCookie()[0]!.split(';')[0]!; }
          assert(response.ok, 'API probe failed with HTTP ' + response.status + ' ' + (data.error?.code || 'UNKNOWN'));
          return data;
        }
        try {
          stage = 'cart and checkout SQL through Express'; progress();
          await request('/auth/csrf', studentToken);
          const cart = cartSchema.parse(await request('/cart', studentToken));
          const filled = cartSchema.parse(await request('/cart/items', studentToken, 'POST', { expectedVersion: cart.version, menuItemId: item.id, quantity: 1 }));
          const body = { expectedVersion: filled.version, quote: filled.quote, pickupAt: new Date(Date.now() + 20 * 60000).toISOString() };
          const key = randomUUID();
          const created = orderSchema.parse(await request('/orders', studentToken, 'POST', body, key));
          assert.equal(created.status, 'RECEIVED'); assert.equal(created.totalPaise, 1); assert.equal(created.canteenId, canteen.id);
          assert.deepEqual(await request('/orders', studentToken, 'POST', body, key), created);
          assert.equal(cartSchema.parse(await request('/cart', studentToken)).items.length, 0);
          stage = 'fulfillment SQL through Express'; progress();
          let order = created;
          for (const action of ['accept', 'prepare', 'ready']) { stage = 'fulfillment ' + action; progress(); order = orderSchema.parse(await request('/orders/' + order.id + '/' + action, staffToken, 'POST', { expectedVersion: order.version }, randomUUID())); }
          assert.equal(order.status, 'READY'); assert.equal(order.events.length, 4);
          assert.equal(await tx.outboxEvent.count({ where: { event: { orderId: order.id } } }), 4);
          assert.equal(await tx.orderCodeAllocation.count({ where: { orderId: order.id } }), 1);
          assert.equal((await request('/orders/' + order.id, studentToken)).status, 'READY');
        } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
        throw rollback;
      }, { maxWait: config.DB_TIMEOUT_MS, timeout: 180000 });
    } catch (error) { if (error !== rollback) throw error; }
    stage = 'rollback verification';
    assert.equal(await db.canteen.count({ where: { id: canteenId } }), 0);
    console.log('PASS: live application-role checkout, stable retry, pickup allocation, scoped reads and accept/prepare/ready');
    console.log('PASS: all temporary users, sessions, menus, orders, histories and outbox entries rolled back; no email sent');
  } catch (error) {
    if (error instanceof Error && /^API probe failed with HTTP [0-9]{3} [A-Z_]+$/.test(error.message)) console.error(error.message);
    if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)) console.error('Error code: ' + error.code);
    console.error('Live order qualification failed at: ' + stage + '.');
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
void main().catch(() => { console.error('Live order qualification failed during setup.'); process.exitCode = 1; });
