import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed } from '../../src/services/provision.js';
import { contracts, cartSchema, menuItemSchema } from '../../src/schemas/contracts.js';
import type { Role } from '../../src/generated/prisma/client.js';
const url = process.env.CATALOG_TEST_DATABASE_URL;
test('catalog categories and persistent carts with isolated PostgreSQL', { skip: !url }, async t => {
  assert(url);
  const address = new URL(url);
  assert(['localhost', '127.0.0.1'].includes(address.hostname) && address.pathname.includes('test'));
  assert.notEqual(url, process.env.DATABASE_URL);
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url }, encoding: 'utf8', timeout: 180000 });
  assert.equal(migration.status, 0, migration.stderr);
  const config = loadConfig({ DATABASE_URL: url, APP_ENV: 'test', NODE_ENV: 'test', FRONTEND_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32), SEED_DEVELOPMENT_DATA: 'true', LOG_LEVEL: 'silent', DB_TIMEOUT_MS: '10000' });
  const db = createPrisma(config);
  await seed(db, config);
  const canteen = await db.canteen.findUniqueOrThrow({ where: { slug: 'bella-bite' } });
  const other = await db.canteen.findUniqueOrThrow({ where: { slug: 'shanu' } });
  const server = createApp(config, db, () => {}).listen(0, '127.0.0.1');
  await once(server, 'listening'); const port = server.address(); assert(port && typeof port !== 'string');
  const base = `http://127.0.0.1:${port.port}/api/v1`;
  class Browser {
    jar = new Map<string, string>(); csrf = '';
    async request(path: string, method = 'GET', body?: object) {
      const response = await fetch(base + path, { method, headers: { Origin: config.FRONTEND_ORIGIN, Cookie: [...this.jar].map(([key, value]) => `${key}=${value}`).join('; '), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0]!.split('='); this.jar.set(name!, value!); }
      return { status: response.status, body: await response.json() };
    }
    async prepare() { this.csrf = (await this.request('/auth/csrf')).body.csrfToken; return this; }
  }
  async function fixture(role: Role, email: string, canteenId?: string) {
    const user = await db.user.create({ data: { email, name: 'Test User', supabaseSubject: randomUUID(), emailVerifiedAt: new Date(), roles: { create: { role } } } });
    const membership = canteenId ? await db.canteenMembership.create({ data: { userId: user.id, canteenId, codeVersion: 1 } }) : null;
    const token = randomBytes(32).toString('hex');
    const session = await db.session.create({ data: { userId: user.id, role, canteenId, membershipId: membership?.id, tokenHash: createHmac('sha256', config.SESSION_SECRET).update(`session:${token}`).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    const browser = await new Browser().prepare(); browser.jar.set('spoonate_session', token);
    return { user, session, browser };
  }
  const staff = await fixture('CANTEEN', 'menu-staff@example.edu', canteen.id);
  const otherStaff = await fixture('CANTEEN', 'other-staff@example.edu', other.id);
  const student = await fixture('STUDENT', 'cart-student@banasthali.in');
  const second = await fixture('STUDENT', 'second@banasthali.in');
  const device = await new Browser().prepare(); device.jar.set('spoonate_session', student.browser.jar.get('spoonate_session')!);
  let categoryId: string, categoryVersion: number, itemId: string;
  const fresh = async (browser = student.browser) => { const r = await browser.request('/cart'); assert.equal(r.status, 200); return cartSchema.parse(r.body); };
  const add = async (id: string, quantity = 1) => student.browser.request('/cart/items', 'POST', { expectedVersion: (await fresh()).version, menuItemId: id, quantity });
  try {
    await t.test('anonymous reads are public but writes, management and carts require a valid scoped session', async () => {
      const anonymous = await new Browser().prepare();
      const response = await anonymous.request('/catalog'); assert.equal(response.status, 200); contracts['GET /catalog']!.response.parse(response.body);
      assert.equal((await anonymous.request(`/canteens/${canteen.id}/menu`)).status, 200);
      assert.equal((await anonymous.request('/cart')).status, 401);
      assert.equal((await anonymous.request(`/canteens/${canteen.id}/categories`, 'POST', { name: 'Chinese' })).status, 401);
      assert.equal((await student.browser.request(`/canteens/${canteen.id}/menu/manage`)).status, 403);
      assert.equal((await otherStaff.browser.request(`/canteens/${canteen.id}/categories`, 'POST', { name: 'Chinese' })).status, 403);
      assert.equal((await staff.browser.request('/cart')).status, 403);
    });
    await t.test('staff create case-insensitive unique categories and items inside their own canteen', async () => {
      const response = await staff.browser.request(`/canteens/${canteen.id}/categories`, 'POST', { name: ' Chinese ' });
      assert.equal(response.status, 201); categoryId = response.body.id; categoryVersion = response.body.version;
      assert.equal((await staff.browser.request(`/canteens/${canteen.id}/categories`, 'POST', { name: 'chinese' })).status, 409);
      assert.equal((await staff.browser.request(`/canteens/${canteen.id}/menu`, 'POST', { name: 'Noodles', categoryId, pricePaise: 100.5 })).status, 422);
      const item = await staff.browser.request(`/canteens/${canteen.id}/menu`, 'POST', { name: 'Noodles', categoryId, pricePaise: 6050 });
      assert.equal(item.status, 201); menuItemSchema.parse(item.body); itemId = item.body.id;
      assert.equal((await otherStaff.browser.request(`/canteens/${other.id}/menu`, 'POST', { name: 'Cross scope', categoryId, pricePaise: 1000 })).status, 422);
      await assert.rejects(db.menuItem.create({ data: { canteenId: other.id, categoryId, name: 'Cross scope', pricePaise: 1000 } }));
      const menu = await student.browser.request(`/canteens/${canteen.id}/menu`); contracts['GET /canteens/:id/menu']!.response.parse(menu.body);
      assert(menu.body.categories.some((c: { id: string }) => c.id === categoryId));
      assert(menu.body.items.some((i: { categoryId: string }) => i.categoryId === categoryId));
    });
    await t.test('committed menu writes notify other browsers immediately through the catalog stream', async () => {
      const response = await fetch(`${base}/catalog/events`, { signal: AbortSignal.timeout(10000) });
      const reader = response.body!.getReader();
      try {
        assert.match(new TextDecoder().decode((await reader.read()).value), /event: catalog-change/);
        const updated = await staff.browser.request(`/canteens/${canteen.id}/settings`, 'PATCH', { expectedVersion: canteen.version, hours: '9 AM–8 PM' });
        assert.equal(updated.status, 200);
        const event = new TextDecoder().decode((await reader.read()).value);
        assert(event.includes(canteen.id));
        const snapshot = await student.browser.request('/catalog');
        assert.equal(snapshot.body.canteens.find((c: { id: string }) => c.id === canteen.id).hours, '9 AM–8 PM');
      } finally { await reader.cancel(); }
    });
    await t.test('menu ownership, stale updates, category renaming and nonempty archival are enforced', async () => {
      assert.equal((await otherStaff.browser.request(`/menu-items/${itemId}`, 'PATCH', { expectedVersion: 1, pricePaise: 1 })).status, 403);
      assert.equal((await staff.browser.request(`/menu-items/${itemId}`, 'PATCH', { expectedVersion: 20, pricePaise: 1 })).status, 409);
      assert.equal((await staff.browser.request(`/menu-categories/${categoryId}`, 'PATCH', { expectedVersion: categoryVersion, archived: true })).status, 409);
      const renamed = await staff.browser.request(`/menu-categories/${categoryId}`, 'PATCH', { expectedVersion: categoryVersion, name: 'Chinese favourites' });
      assert.equal(renamed.status, 200); categoryVersion = renamed.body.version;
      assert.equal((await staff.browser.request(`/menu-categories/${categoryId}`, 'PATCH', { expectedVersion: 1, name: 'Old edit' })).status, 409);
      const menu = await student.browser.request(`/canteens/${canteen.id}/menu`);
      assert.equal(menu.body.items.find((i: { id: string }) => i.id === itemId).category, 'Chinese favourites');
    });
    await t.test('first cart creation and simultaneous device writes serialize with one conflict', async () => {
      const [first, otherRead] = await Promise.all([fresh(), fresh(device)]); assert.equal(first.id, otherRead.id);
      const [a, b] = await Promise.all([student.browser.request('/cart/items', 'POST', { expectedVersion: first.version, menuItemId: itemId, quantity: 1 }), device.request('/cart/items', 'POST', { expectedVersion: first.version, menuItemId: itemId, quantity: 1 })]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
      const loser = a.status === 409 ? a : b; assert.equal(loser.body.error.details.cart.items[0].quantity, 1);
      const restored = await fresh(device); assert.equal(restored.items.length, 1); assert.equal(restored.totalPaise, 6050);
    });
    await t.test('cart line ownership, quantity bounds and single-canteen contents are enforced', async () => {
      const current = await fresh(); const secondCart = await fresh(second.browser);
      assert.equal((await second.browser.request(`/cart/items/${current.items[0]!.id}`, 'DELETE', { expectedVersion: secondCart.version })).status, 404);
      assert.equal((await student.browser.request(`/cart/items/${current.items[0]!.id}`, 'PATCH', { expectedVersion: current.version, quantity: 100 })).status, 422);
      assert.equal((await add(itemId, 99)).status, 422);
      const otherItem = await db.menuItem.findFirstOrThrow({ where: { canteenId: other.id } });
      assert.equal((await add(otherItem.id)).body.error.code, 'MIXED_CANTEENS');
      assert.equal((await fresh()).items.length, 1);
      assert.equal((await fresh(second.browser)).items.length, 0);
    });
    await t.test('quotes are verifiable, tied to the student and expire', async () => {
      const cart = await fresh();
      assert.equal((await student.browser.request('/cart/review', 'POST', { expectedVersion: cart.version, quote: cart.quote })).status, 200);
      assert.equal((await student.browser.request('/cart/review', 'POST', { expectedVersion: cart.version, quote: `${cart.quote}tampered` })).status, 409);
      const foreign = await fresh(second.browser);
      assert.equal((await second.browser.request('/cart/review', 'POST', { expectedVersion: foreign.version, quote: cart.quote })).status, 409);
      const payload = JSON.parse(Buffer.from(cart.quote.split('.')[0]!, 'base64url').toString()); payload.expiresAt = new Date(Date.now() - 1000).toISOString();
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url'); const signature = createHmac('sha256', config.SESSION_SECRET).update(`cart-quote:${encoded}`).digest('base64url');
      assert.equal((await student.browser.request('/cart/review', 'POST', { expectedVersion: cart.version, quote: `${encoded}.${signature}` })).status, 409);
    });
    await t.test('menu price changes reject stale reviews and return current totals without rewriting historical orders', async () => {
      const cart = await fresh();
      const order = await db.order.create({ data: { studentId: student.user.id, canteenId: canteen.id, totalPaise: 6050, pickupAt: new Date(), codeDay: new Date('2026-10-15'), items: { create: { menuItemId: itemId, name: 'Noodles', quantity: 1, unitPricePaise: 6050 } } } });
      assert.equal((await staff.browser.request(`/menu-items/${itemId}`, 'PATCH', { expectedVersion: 1, pricePaise: 7000, name: 'Veg noodles' })).status, 200);
      const stale = await student.browser.request('/cart/review', 'POST', { expectedVersion: cart.version, quote: cart.quote });
      assert.equal(stale.status, 409); assert.equal(stale.body.error.code, 'QUOTE_CHANGED'); assert.equal(stale.body.error.details.cart.totalPaise, 7000);
      const history = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } }); assert.equal(history.unitPricePaise, 6050); assert.equal(history.name, 'Noodles');
    });
    await t.test('paused canteens block additions/increases and reviews, while removals and reductions work', async () => {
      assert.equal((await add(itemId, 2)).status, 200);
      const current = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      assert.equal((await staff.browser.request(`/canteens/${canteen.id}/availability`, 'PATCH', { expectedVersion: current.version, acceptingOrders: false })).status, 200);
      assert.equal((await staff.browser.request(`/canteens/${canteen.id}/availability`, 'PATCH', { expectedVersion: current.version, acceptingOrders: true })).status, 409);
      assert.equal((await add(itemId)).status, 409);
      const cart = await fresh(); assert.equal(cart.available, false);
      assert.equal((await student.browser.request(`/cart/items/${cart.items[0]!.id}`, 'PATCH', { expectedVersion: cart.version, quantity: 4 })).status, 409);
      assert.equal((await student.browser.request(`/cart/items/${cart.items[0]!.id}`, 'PATCH', { expectedVersion: cart.version, quantity: 1 })).status, 200);
      const reduced = await fresh(); assert.equal((await student.browser.request('/cart/review', 'POST', { expectedVersion: reduced.version, quote: reduced.quote })).body.error.code, 'CART_UNAVAILABLE');
      assert.equal((await student.browser.request(`/cart/items/${reduced.items[0]!.id}`, 'DELETE', { expectedVersion: reduced.version })).status, 200);
      assert.equal((await fresh()).canteenId, null);
      const otherItem = await db.menuItem.findFirstOrThrow({ where: { canteenId: other.id } }); assert.equal((await add(otherItem.id)).status, 200);
    });
    await t.test('archival hides items/categories, preserves cart removals and supports restoration', async () => {
      const cart = await fresh(); assert.equal((await student.browser.request('/cart', 'DELETE', { expectedVersion: cart.version })).status, 200);
      const current = await db.canteen.findUniqueOrThrow({ where: { id: canteen.id } });
      await staff.browser.request(`/canteens/${canteen.id}/availability`, 'PATCH', { expectedVersion: current.version, acceptingOrders: true });
      await add(itemId);
      assert.equal((await staff.browser.request(`/menu-items/${itemId}`, 'PATCH', { expectedVersion: 2, archived: true })).status, 200);
      assert.equal((await fresh()).items[0]!.available, false);
      assert.equal((await add(itemId)).status, 409);
      assert.equal((await staff.browser.request(`/menu-categories/${categoryId}`, 'PATCH', { expectedVersion: categoryVersion, archived: true })).status, 200); categoryVersion++;
      const publicMenu = await student.browser.request(`/canteens/${canteen.id}/menu`);
      assert(!publicMenu.body.items.some((i: { id: string }) => i.id === itemId)); assert(!publicMenu.body.categories.some((c: { id: string }) => c.id === categoryId));
      assert.equal((await staff.browser.request(`/menu-items/${itemId}`, 'PATCH', { expectedVersion: 3, archived: false })).status, 422);
      const archivedCart = await fresh(); assert.equal((await student.browser.request('/cart', 'DELETE', { expectedVersion: archivedCart.version })).status, 200);
      assert.equal((await staff.browser.request(`/menu-categories/${categoryId}`, 'PATCH', { expectedVersion: categoryVersion, archived: false })).status, 200);
      assert.equal((await staff.browser.request(`/menu-items/${itemId}`, 'PATCH', { expectedVersion: 3, archived: false })).status, 200);
    });
    await t.test('large price totals remain readable and removable while checkout review enforces the order limit', async () => {
      for (let index = 0; index < 3; index++) {
        const expensive = await db.menuItem.create({ data: { canteenId: canteen.id, categoryId, name: 'Boundary price ' + index, pricePaise: 10000000 } });
        assert.equal((await add(expensive.id, 99)).status, 200);
      }
      const cart = await fresh(); assert.equal(cart.totalPaise, 2970000000);
      assert.equal((await student.browser.request('/cart/review', 'POST', { expectedVersion: cart.version, quote: cart.quote })).body.error.code, 'CART_LIMIT');
      assert.equal((await student.browser.request('/cart/items/' + cart.items[0]!.id, 'DELETE', { expectedVersion: cart.version })).status, 200);
      const reduced = await fresh(); assert.equal(reduced.totalPaise, 1980000000);
      assert.equal((await student.browser.request('/cart/review', 'POST', { expectedVersion: reduced.version, quote: reduced.quote })).status, 200);
    });
    await t.test('permanent deletion enforces scope and versions, clears carts and preserves order snapshots', async () => {
      const category = await db.menuCategory.create({ data: { canteenId: canteen.id, name: 'Delete fixtures' } });
      const item = await db.menuItem.create({ data: { canteenId: canteen.id, categoryId: category.id, name: 'Deleted tea', pricePaise: 1000 } });
      const current = await fresh();
      await student.browser.request('/cart', 'DELETE', { expectedVersion: current.version });
      assert.equal((await add(item.id)).status, 200);
      const before = await fresh();
      const order = await db.order.create({ data: { studentId: student.user.id, canteenId: canteen.id, totalPaise: 1000, pickupAt: new Date(), codeDay: new Date(), items: { create: { menuItemId: item.id, name: item.name, quantity: 1, unitPricePaise: 1000 } } }, include: { items: true } });
      assert.equal((await otherStaff.browser.request(`/menu-items/${item.id}`, 'DELETE', { expectedVersion: 1 })).status, 403);
      assert.equal((await student.browser.request(`/menu-items/${item.id}`, 'DELETE', { expectedVersion: 1 })).status, 403);
      assert.equal((await staff.browser.request(`/menu-items/${item.id}`, 'DELETE', { expectedVersion: 99 })).status, 409);
      assert.equal((await staff.browser.request(`/menu-items/${item.id}`, 'DELETE', { expectedVersion: 1 })).status, 200);
      assert.equal(await db.menuItem.findUnique({ where: { id: item.id } }), null);
      const after = await fresh();
      assert.equal(after.items.length, 0); assert.equal(after.canteenId, null); assert(after.version > before.version);
      const snapshot = await db.orderItem.findUniqueOrThrow({ where: { id: order.items[0]!.id } });
      assert.deepEqual(snapshot, { ...order.items[0], menuItemId: null });
      await assert.rejects(db.orderItem.update({ where: { id: snapshot.id }, data: { name: 'Rewritten history' } }));
      await assert.rejects(db.orderItem.delete({ where: { id: snapshot.id } }));
      const active = await db.menuItem.create({ data: { canteenId: canteen.id, categoryId: category.id, name: 'Active tea', pricePaise: 1000 } });
      const archived = await db.menuItem.create({ data: { canteenId: canteen.id, categoryId: category.id, name: 'Archived tea', pricePaise: 1000, archived: true } });
      assert.equal((await add(active.id)).status, 200);
      assert.equal((await otherStaff.browser.request(`/menu-categories/${category.id}`, 'DELETE', { expectedVersion: 1 })).status, 403);
      assert.equal((await staff.browser.request(`/menu-categories/${category.id}`, 'DELETE', { expectedVersion: 99 })).status, 409);
      assert.equal((await staff.browser.request(`/menu-categories/${category.id}`, 'DELETE', { expectedVersion: 1 })).status, 200);
      assert.equal(await db.menuCategory.findUnique({ where: { id: category.id } }), null);
      assert.equal(await db.menuItem.count({ where: { id: { in: [active.id, archived.id] } } }), 0);
      assert.equal((await fresh()).items.length, 0);
      const managed = await staff.browser.request(`/canteens/${canteen.id}/menu/manage`);
      assert(!managed.body.categories.some((entry: { id: string }) => entry.id === category.id));
      assert(!managed.body.items.some((entry: { id: string }) => [item.id, active.id, archived.id].includes(entry.id)));
    });
    await t.test('revoked canteen sessions and disabled students cannot mutate menus or carts', async () => {
      await db.session.update({ where: { id: staff.session.id }, data: { revokedAt: new Date() } });
      assert.equal((await staff.browser.request(`/canteens/${canteen.id}/categories`, 'POST', { name: 'Forbidden' })).status, 401);
      await db.user.update({ where: { id: student.user.id }, data: { status: 'DISABLED' } });
      assert.equal((await student.browser.request('/cart')).status, 401);
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
});
