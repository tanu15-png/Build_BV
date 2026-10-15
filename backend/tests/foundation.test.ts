import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { contracts, errorSchema } from '../src/schemas/contracts.js';
import { healthResponseSchema } from '../src/schemas/health.schema.js';
import { hashSecret, verifySecret } from '../src/services/hash.js';
import { validate } from '../src/middleware/validate.js';
import express from 'express';
import { requestId } from '../src/middleware/requestId.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
export const configInput = { DATABASE_URL: 'postgresql://localhost/spoonate', FRONTEND_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), LOG_LEVEL: 'silent' };
const config = loadConfig(configInput);
async function serve(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
test('configuration rejects unsafe deployed settings without exposing secrets', () => {
  assert.throws(() => loadConfig({ ...configInput, DATABASE_URL: 'SECRET' }), e => e instanceof Error && !e.message.includes('SECRET'));
  for (const override of [{ SEED_DEVELOPMENT_DATA: 'true' }, { EMAIL_VERIFICATION_BYPASS: 'true' }, { ORDER_MODE: 'PAID' }]) {
    assert.throws(() => loadConfig({ ...configInput, APP_ENV: 'production', ...override }));
  }
  assert.throws(() => loadConfig({ ...configInput, PORT: '70000' }));
});
test('HTTP health, errors, origins, bounds and redacted logs', async () => {
  const entries: object[] = [];
  const db = { $queryRawUnsafe: async () => 1, canteen: { findMany: async () => [] } } as unknown as PrismaClient;
  await serve(createApp({ ...config, LOG_LEVEL: 'info' }, db, e => entries.push(e)), async base => {
    for (const route of ['live', 'ready']) {
      const res = await fetch(`${base}/health/${route}`); assert.equal(res.status, 200); healthResponseSchema.parse(await res.json()); assert(res.headers.get('x-request-id'));
    }
    const missing = await fetch(`${base}/nope?password=DO_NOT_LOG`); assert.equal(missing.status, 404); errorSchema.parse(await missing.json());
    assert.equal((await fetch(`${base}/api/v1/canteens`, { headers: { origin: 'https://evil.example' } })).status, 403);
    const allowed = await fetch(`${base}/api/v1/canteens`, { headers: { origin: config.FRONTEND_ORIGIN } }); assert.equal(allowed.headers.get('access-control-allow-origin'), config.FRONTEND_ORIGIN);
    assert.equal((await fetch(`${base}/missing`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"password":"DO_NOT_LOG",' })).status, 422);
    assert.equal((await fetch(`${base}/missing`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'x'.repeat(110000) }) })).status, 413);
    const untrusted = await fetch(`${base}/health/live`, { headers: { 'x-request-id': 'secret/invalid' } }); assert.notEqual(untrusted.headers.get('x-request-id'), 'secret/invalid');
  });
  assert(!JSON.stringify(entries).includes('DO_NOT_LOG'));
});
test('readiness fails within deadline while liveness remains healthy', async () => {
  for (const check of [async () => { throw new Error('postgres://secret'); }, () => new Promise(() => {})]) {
    const db = { $queryRawUnsafe: check } as unknown as PrismaClient;
    await serve(createApp({ ...config, DB_TIMEOUT_MS: 100 }, db), async base => {
      const res = await fetch(`${base}/health/ready`); assert.equal(res.status, 503); assert.deepEqual(await res.json(), { ok: false, status: 'not_ready' });
      assert.equal((await fetch(`${base}/health/live`)).status, 200);
    });
  }
});
test('salted hashes verify and reject malformed hashes and wrong values', async () => {
  const a = await hashSecret('a strong secret'); const b = await hashSecret('a strong secret');
  assert.notEqual(a, b); assert(await verifySecret('a strong secret', a)); assert.equal(await verifySecret('incorrect', a), false); assert.equal(await verifySecret('x', 'scrypt$bad$bad'), false);
});
test('frontend fixtures enforce identity, quantity, campus domain, paise, status and secret exclusion', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  contracts['POST /auth/student/signup']!.body.parse({ name: 'Student', email: 'student@banasthali.in', password: 'correct horse battery' });
  for (const email of ['student@gmail.com', 'student@sub.banasthali.in', 'student@banasthali.in.evil']) assert.equal(contracts['POST /auth/student/signup']!.body.safeParse({ name: 'S', email, password: 'correct horse battery' }).success, false);
  assert.equal(contracts['POST /orders']!.body.safeParse({ expectedVersion: 1, pickupAt: '2026-10-14T14:00:00Z', quote: 'signed-quote', studentId: id, totalPaise: 1 }).success, false);
  contracts['POST /cart/items']!.body.parse({ expectedVersion: 1, menuItemId: id, quantity: 2 });
  assert.equal(contracts['POST /cart/items']!.body.safeParse({ expectedVersion: 1, menuItemId: id, quantity: 0 }).success, false);
  assert.equal(contracts['POST /canteens/:id/menu']!.body.safeParse({ name: 'Tea', category: 'Drinks', pricePaise: 1.1 }).success, false);
  assert.equal(contracts['GET /canteens']!.response.safeParse({ canteens: [{ id, slug: 'bella-bite', name: 'Bella Bite', location: null, hours: null, acceptingOrders: true, operational: true, version: 1, codeHash: 'secret' }] }).success, false);
  assert.equal(Object.keys(contracts).length, 37);
});
test('validation handles body, params and parsed query with stable 422 envelope', async () => {
  const app = express(); app.use(requestId); app.use(express.json());
  app.post('/signup', validate(contracts['POST /auth/student/signup']!.body), (_req, res) => { res.json({ ok: true }); });
  app.get('/:id', validate(contracts['GET /canteens/:id/members']!.params, 'params'), validate(contracts['GET /canteens/:id/members']!.query, 'query'), (_req, res) => { res.json(res.locals.query); });
  app.use(errorHandler);
  await serve(app, async base => {
    const result = await fetch(`${base}/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'secret', password: 'SECRET' }) });
    assert.equal(result.status, 422); const text = await result.text(); assert(!text.includes('SECRET')); errorSchema.parse(JSON.parse(text));
    assert.equal((await fetch(`${base}/bad-id`)).status, 422);
    const res = await fetch(`${base}/00000000-0000-4000-8000-000000000001?limit=5`); assert.deepEqual(await res.json(), { limit: 5 });
  });
});

test('shared frontend API fixtures match backend request and response contracts', () => {
  const fixtures = JSON.parse(readFileSync('../frontend/tests/fixtures/api-contracts.json', 'utf8'));
  for (const fixture of fixtures) {
    assert(contracts[fixture.route], fixture.route);
    contracts[fixture.route]!.body.parse(fixture.body);
    contracts[fixture.route]!.response.parse(fixture.response);
  }
});
