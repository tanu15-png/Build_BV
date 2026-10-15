import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed, directory, rotateCode, provisionAdmin } from '../../src/services/provision.js';
import { verifySecret } from '../../src/services/hash.js';
import { createApp } from '../../src/app.js';
const url = process.env.TEST_DATABASE_URL;
test('migrations, repeatable seeds, constraints, provisioning and safe catalog', { skip: !url }, async () => {
  assert(url);
  // Explicit dedicated test URL only; refuse accidental use of the application database.
  assert.notEqual(url, process.env.DATABASE_URL, 'Test database must differ from application database');
  const config = loadConfig({ DATABASE_URL: url, FRONTEND_ORIGIN: 'http://localhost:5173', APP_ENV: 'test', NODE_ENV: 'test', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SEED_DEVELOPMENT_DATA: 'true', LOG_LEVEL: 'silent', DB_TIMEOUT_MS: '10000' });
  const db = createPrisma(config);
  try {
    const applyMigration = () => {
      const migration: SpawnSyncReturns<string> = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url }, encoding: 'utf8', timeout: 180000 });
      assert.equal(migration.status, 0, migration.stderr);
    };
    applyMigration();
    await seed(db, config);
    assert.equal(await db.canteen.count(), 8);
    const canteens = await db.canteen.findMany();
    assert.deepEqual(canteens.map(c => c.name).sort(), directory.map(([, n]) => n).sort());
    const canteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'bella-bite' } });
    const item = await db.menuItem.findFirstOrThrow({ where: { canteenId: canteen.id } });
    await db.menuItem.update({ where: { id: item.id }, data: { pricePaise: 1234, available: false } });
    await db.canteen.update({ where: { id: canteen.id }, data: { acceptingOrders: false } });
    applyMigration();
    await seed(db, config);
    assert.equal(await db.menuItem.count(), 16);
    assert.equal((await db.menuItem.findUniqueOrThrow({ where: { id: item.id } })).pricePaise, 1234);
    assert.equal((await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } })).acceptingOrders, false);
    const firstCode = await db.canteenAccessCode.findFirstOrThrow({ where: { canteenId: canteen.id, active: true } });
    assert(await verifySecret('Bella Bite', firstCode.codeHash));
    await rotateCode(db, config, 'bella-bite', 'new strong operator code');
    await seed(db, config);
    const active = await db.canteenAccessCode.findFirstOrThrow({ where: { canteenId: canteen.id, active: true } });
    assert.equal(active.version, 2); assert(await verifySecret('new strong operator code', active.codeHash));
    await assert.rejects(() => rotateCode(db, { ...config, SEED_DEVELOPMENT_DATA: false }, 'bella-bite', "Mukteshwari's Canteen"));
    await assert.rejects(() => provisionAdmin(db, 'admin@example.edu', 'Admin', 'admin123'));
    await provisionAdmin(db, 'admin@example.edu', 'Admin', 'unique operator password');
    const admin = await db.user.findUniqueOrThrow({ where: { email: 'admin@example.edu' }, include: { roles: true } });
    assert.equal(admin.roles[0]?.role, 'ADMIN'); assert(await verifySecret('unique operator password', admin.passwordHash!));
    await assert.rejects(() => provisionAdmin(db, 'admin@example.edu', 'Admin', 'another operator password'));
    await assert.rejects(() => db.menuItem.update({ where: { id: item.id }, data: { pricePaise: -1 } }));
    const cart = await db.cart.create({ data: { studentId: admin.id, canteenId: canteen.id } });
    await assert.rejects(() => db.cartItem.create({ data: { cartId: cart.id, canteenId: canteen.id, menuItemId: item.id, quantity: 0 } }));
    const other = await db.menuItem.findFirstOrThrow({ where: { canteenId: { not: canteen.id } } });
    await assert.rejects(() => db.cartItem.create({ data: { cartId: cart.id, canteenId: canteen.id, menuItemId: other.id, quantity: 1 } }));
    const codeDay = new Date('2026-10-14T00:00:00Z');
    const order = await db.order.create({ data: { studentId: admin.id, canteenId: canteen.id, pickupAt: new Date(), codeDay, orderCode: 'A01', totalPaise: 100 } });
    await db.orderCodeAllocation.create({ data: { orderId: order.id, codeDay, code: 'A01' } });
    await assert.rejects(() => db.order.create({ data: { studentId: admin.id, canteenId: canteen.id, pickupAt: new Date(), codeDay, orderCode: 'A01', totalPaise: 100 } }));
    await assert.rejects(() => db.order.update({ where: { id: order.id }, data: { codeDay: new Date('2026-10-15T00:00:00Z') } }));
    await assert.rejects(() => db.orderCodeAllocation.delete({ where: { orderId: order.id } }));
    await assert.rejects(() => db.orderCodeAllocation.create({ data: { orderId: randomUUID(), codeDay, code: 'A02' } }));
    await db.rateLimit.create({ data: { key: 'test', windowEndsAt: new Date(), count: 1 } });
    await assert.rejects(() => db.rateLimit.update({ where: { key: 'test' }, data: { count: -1 } }));
    // Production-style seeds only insert directory records, never sample menus or codes.
    await seed(db, { ...config, SEED_DEVELOPMENT_DATA: false }); assert.equal(await db.menuItem.count(), 16);
    const server = createApp(config, db).listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const address = server.address(); assert(address && typeof address !== 'string');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/canteens`); assert.equal(response.status, 200);
      const text = await response.text(); assert.equal(JSON.parse(text).canteens.length, 8);
      assert(!text.includes('scrypt')); assert(!text.includes('codeHash')); assert(!text.includes('password'));
      assert.equal((await fetch(`http://127.0.0.1:${address.port}/health/ready`)).status, 200);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  } finally { await db.$disconnect(); }
});
