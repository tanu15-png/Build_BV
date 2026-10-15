import { Router, type Request } from 'express';
import type { Config } from '../config/env.js';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { createSessionReader } from '../services/session.js';
import { cartInclude, cartResponse, verifyCartQuote } from '../services/cart.js';
import { contracts } from '../schemas/contracts.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
type Tx = Prisma.TransactionClient;
export function createCatalogRouter(config: Config, db: PrismaClient) {
  const router = Router();
  const readSession = createSessionReader(config, db);
  const txOptions = { maxWait: config.DB_TIMEOUT_MS, timeout: 15000 };
  function route(key: string) {
    const contract = contracts[key]!;
    return [validate(contract.params, 'params'), validate(contract.query, 'query'), ...(key.startsWith('GET ') ? [] : [validate(contract.body)])];
  }
  const conflict = () => new AppError(409, 'VERSION_CONFLICT', 'This record changed. Refresh and retry.');
  const menuItem = (row: Prisma.MenuItemGetPayload<{ include: { category: true } }>) => ({ ...row, category: row.category.name });
  async function menu(tx: Tx, id: string, manage: boolean) {
    const canteen = await tx.canteen.findUnique({ where: { id } });
    if (!canteen) throw new AppError(404, 'CANTEEN_NOT_FOUND', 'Canteen not found.');
    const categories = await tx.menuCategory.findMany({ where: { canteenId: id, ...(!manage ? { archived: false } : {}) }, orderBy: { name: 'asc' } });
    const items = await tx.menuItem.findMany({ where: { canteenId: id, ...(!manage ? { archived: false, category: { archived: false } } : {}) }, orderBy: { name: 'asc' }, include: { category: true } });
    return { canteen, categories, items: items.map(menuItem) };
  }
  async function staffWrite<T>(req: Request, canteenId: string, work: (tx: Tx) => Promise<T>) {
    const { actor } = await readSession(req);
    if (actor.role !== 'CANTEEN' || actor.canteenId !== canteenId) throw new AppError(403, 'CANTEEN_DENIED', 'You can only manage your own canteen.');
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${canteenId}::uuid FOR UPDATE`;
      await createSessionReader(config, tx)(req);
      return work(tx);
    }, txOptions);
  }
  async function category(tx: Tx, categoryId: string, canteenId: string) {
    const found = await tx.menuCategory.findFirst({ where: { id: categoryId, canteenId, archived: false } });
    if (!found) throw new AppError(422, 'CATEGORY_INVALID', 'Choose an active category from your own canteen.');
    return found;
  }
  router.get('/catalog', async (_req, res) => {
    res.json(await db.$transaction(async tx => {
      const canteens = await tx.canteen.findMany({ orderBy: { slug: 'asc' } });
      const categories = await tx.menuCategory.findMany({ where: { archived: false }, orderBy: { name: 'asc' } });
      const items = await tx.menuItem.findMany({ where: { archived: false, category: { archived: false } }, orderBy: { name: 'asc' }, include: { category: true } });
      return { canteens, categories, items: items.map(menuItem) };
    }, { ...txOptions, isolationLevel: 'RepeatableRead' }));
  });
  router.get('/canteens/:id/menu', ...route('GET /canteens/:id/menu'), async (_req, res) => {
    res.json(await db.$transaction(tx => menu(tx, res.locals.params.id, false), { ...txOptions, isolationLevel: 'RepeatableRead' }));
  });
  router.get('/canteens/:id/menu/manage', ...route('GET /canteens/:id/menu/manage'), async (req, res) => {
    res.json(await staffWrite(req, res.locals.params.id, tx => menu(tx, res.locals.params.id, true)));
  });
  router.post('/canteens/:id/categories', ...route('POST /canteens/:id/categories'), async (req, res) => {
    res.status(201).json(await staffWrite(req, res.locals.params.id, tx => tx.menuCategory.create({ data: { name: req.body.name, canteenId: res.locals.params.id } })));
  });
  router.patch('/menu-categories/:id', ...route('PATCH /menu-categories/:id'), async (req, res) => {
    const initial = await db.menuCategory.findUniqueOrThrow({ where: { id: res.locals.params.id } });
    const { expectedVersion, ...data } = req.body;
    res.json(await staffWrite(req, initial.canteenId, async tx => {
      const existing = await tx.menuCategory.findUniqueOrThrow({ where: { id: initial.id } });
      if (existing.version !== expectedVersion) throw conflict();
      if (data.archived && await tx.menuItem.count({ where: { categoryId: existing.id, archived: false } })) throw new AppError(409, 'CATEGORY_NOT_EMPTY', 'Move or archive the items in this category first.');
      return tx.menuCategory.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } });
    }));
  });
  for (const field of ['availability', 'settings'] as const) {
    router.patch(`/canteens/:id/${field}`, ...route(`PATCH /canteens/:id/${field}`), async (req, res) => {
      const { expectedVersion, ...data } = req.body;
      res.json(await staffWrite(req, res.locals.params.id, async tx => {
        const existing = await tx.canteen.findUniqueOrThrow({ where: { id: res.locals.params.id } });
        if (existing.version !== expectedVersion) throw conflict();
        return tx.canteen.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } });
      }));
    });
  }
  router.post('/canteens/:id/menu', ...route('POST /canteens/:id/menu'), async (req, res) => {
    res.status(201).json(await staffWrite(req, res.locals.params.id, async tx => {
      await category(tx, req.body.categoryId, res.locals.params.id);
      return menuItem(await tx.menuItem.create({ data: { ...req.body, canteenId: res.locals.params.id }, include: { category: true } }));
    }));
  });
  router.patch('/menu-items/:id', ...route('PATCH /menu-items/:id'), async (req, res) => {
    const initial = await db.menuItem.findUniqueOrThrow({ where: { id: res.locals.params.id } });
    const { expectedVersion, ...data } = req.body;
    res.json(await staffWrite(req, initial.canteenId, async tx => {
      const existing = await tx.menuItem.findUniqueOrThrow({ where: { id: initial.id } });
      if (existing.version !== expectedVersion) throw conflict();
      if (data.categoryId || data.archived === false || !existing.archived) await category(tx, data.categoryId ?? existing.categoryId, existing.canteenId);
      return menuItem(await tx.menuItem.update({ where: { id: initial.id }, data: { ...data, version: { increment: 1 } }, include: { category: true } }));
    }));
  });
  async function studentCart<T>(req: Request, work: (tx: Tx, cart: Prisma.CartGetPayload<object>, studentId: string) => Promise<T>) {
    const { actor } = await readSession(req);
    if (actor.role !== 'STUDENT') throw new AppError(403, 'STUDENT_REQUIRED', 'Sign in as a student to manage a cart.');
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
      await createSessionReader(config, tx)(req);
      const cart = await tx.cart.upsert({ where: { studentId: actor.id }, create: { studentId: actor.id }, update: {} });
      if (cart.canteenId) await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${cart.canteenId}::uuid FOR UPDATE`;
      return work(tx, cart, actor.id);
    }, txOptions);
  }
  const snapshot = async (tx: Tx, id: string) => cartResponse(await tx.cart.findUniqueOrThrow({ where: { id }, include: cartInclude }), config);
  async function expected(tx: Tx, cart: Prisma.CartGetPayload<object>, value: number) {
    if (cart.version !== value) throw new AppError(409, 'CART_CHANGED', 'Your cart changed on another device. Review the updated cart.', { cart: await snapshot(tx, cart.id) });
  }
  async function available(tx: Tx, itemId: string) {
    const item = await tx.menuItem.findUnique({ where: { id: itemId }, include: { canteen: true, category: true } });
    if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found.');
    if (item.archived || !item.available || item.category.archived || !item.canteen.operational || !item.canteen.acceptingOrders) throw new AppError(409, 'ITEM_UNAVAILABLE', 'This item or canteen is currently unavailable.');
    return item;
  }
  async function changed(tx: Tx, cartId: string) {
    const count = await tx.cartItem.count({ where: { cartId } });
    await tx.cart.update({ where: { id: cartId }, data: { version: { increment: 1 }, ...(!count ? { canteenId: null } : {}) } });
    return snapshot(tx, cartId);
  }
  router.get('/cart', ...route('GET /cart'), async (req, res) => res.json(await studentCart(req, (tx, cart) => snapshot(tx, cart.id))));
  router.post('/cart/items', ...route('POST /cart/items'), async (req, res) => {
    res.json(await studentCart(req, async (tx, cart) => {
      await expected(tx, cart, req.body.expectedVersion);
      const initial = await tx.menuItem.findUniqueOrThrow({ where: { id: req.body.menuItemId } });
      if (cart.canteenId && cart.canteenId !== initial.canteenId) throw new AppError(409, 'MIXED_CANTEENS', 'Your cart contains items from another canteen. Empty it before switching.');
      if (!cart.canteenId) await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${initial.canteenId}::uuid FOR UPDATE`;
      const item = await available(tx, initial.id);
      const line = await tx.cartItem.findUnique({ where: { cartId_menuItemId: { cartId: cart.id, menuItemId: item.id } } });
      const quantity = (line?.quantity ?? 0) + req.body.quantity;
      if (quantity > 99) throw new AppError(422, 'QUANTITY_LIMIT', 'You can add at most 99 of an item.');
      if (!line && await tx.cartItem.count({ where: { cartId: cart.id } }) >= 100) throw new AppError(422, 'CART_LIMIT', 'You can add at most 100 different items.');
      if (!cart.canteenId) await tx.cart.update({ where: { id: cart.id }, data: { canteenId: item.canteenId } });
      await tx.cartItem.upsert({ where: { cartId_menuItemId: { cartId: cart.id, menuItemId: item.id } }, create: { cartId: cart.id, menuItemId: item.id, canteenId: item.canteenId, quantity }, update: { quantity } });
      return changed(tx, cart.id);
    }));
  });
  for (const method of ['patch', 'delete'] as const) {
    router[method]('/cart/items/:id', ...route(`${method.toUpperCase()} /cart/items/:id`), async (req, res) => {
      res.json(await studentCart(req, async (tx, cart) => {
        await expected(tx, cart, req.body.expectedVersion);
        const line = await tx.cartItem.findFirst({ where: { id: res.locals.params.id, cartId: cart.id } });
        if (!line) throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'Cart item not found. Refresh your cart.');
        if (method === 'patch') {
          if (req.body.quantity > line.quantity) await available(tx, line.menuItemId);
          await tx.cartItem.update({ where: { id: line.id }, data: { quantity: req.body.quantity } });
        } else await tx.cartItem.delete({ where: { id: line.id } });
        return changed(tx, cart.id);
      }));
    });
  }
  router.delete('/cart', ...route('DELETE /cart'), async (req, res) => {
    res.json(await studentCart(req, async (tx, cart) => {
      await expected(tx, cart, req.body.expectedVersion);
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return changed(tx, cart.id);
    }));
  });
  router.post('/cart/review', ...route('POST /cart/review'), async (req, res) => {
    res.json(await studentCart(req, async (tx, cart, studentId) => {
      await expected(tx, cart, req.body.expectedVersion);
      const current = await snapshot(tx, cart.id);
      verifyCartQuote(req.body.quote, current, studentId, config);
      return current;
    }));
  });
  return router;
}
