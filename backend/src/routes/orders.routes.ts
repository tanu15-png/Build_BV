import { ensurePickupCredential, decryptPickupCode, matchesPickupCode, pickupFailureLimit, pickupStaffFailureLimit, pickupWindowMs, pickupStaffRateKey, collectionRequestHash } from '../services/pickup.js';
import { Router, type Request } from 'express';
import type { Config } from '../config/env.js';
import type { Prisma, PrismaClient, OrderStatus } from '../generated/prisma/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { contracts } from '../schemas/contracts.js';
import { createSessionReader, type Actor } from '../services/session.js';
import { cartInclude, cartResponse, verifyCartQuote } from '../services/cart.js';
import { allocateOrder, orderInclude, orderResponse, orderTransaction, pickupTime, requestHash, serverNow, type OrderOptions } from '../services/orders.js';

type Tx = Prisma.TransactionClient;
export function createOrdersRouter(config: Config, db: PrismaClient, options: OrderOptions = {}) {
  const router = Router();
  const current = createSessionReader(config, db);
  function route(key: string) {
    const contract = contracts[key]!;
    return [validate(contract.params, 'params'), validate(contract.query, 'query'), ...(key.startsWith('GET ') ? [] : [validate(contract.body)])];
  }
  function key(req: Request) {
    const value = req.get('Idempotency-Key');
    if (!value || !/^[A-Za-z0-9:_-]{16,128}$/.test(value)) throw new AppError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required to safely retry this request.');
    return value;
  }
  async function replay(tx: Tx, actorId: string, action: string, value: string, hash: string) {
    const previous = await tx.idempotencyKey.findUnique({ where: { actorId_action_key: { actorId, action, key: value } } });
    if (!previous) return null;
    if (previous.requestHash !== hash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used with different input.');
    if (previous.state !== 'COMPLETED' || !previous.response) throw new AppError(503, 'REQUEST_IN_PROGRESS', 'This request is still processing. Retry the same request.');
    return { status: previous.responseStatus!, body: previous.response };
  }
  async function event(tx: Tx, orderId: string, actorId: string, previousStatus: OrderStatus | null, newStatus: OrderStatus, at: Date) {
    const history = await tx.orderEvent.create({ data: { orderId, actorId, previousStatus, newStatus, createdAt: at } });
    await tx.outboxEvent.create({ data: { eventId: history.id, availableAt: at,
      payload: { type: 'ORDER_STATUS_CHANGED', orderId, previousStatus, status: newStatus, occurredAt: at.toISOString() } } });
  }
  async function complete(tx: Tx, id: string, orderId: string, status: number) {
    const body = orderResponse(await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
    await tx.idempotencyKey.update({ where: { id }, data: { state: 'COMPLETED', orderId, responseStatus: status, response: body } });
    return { status, body };
  }

  router.post('/orders', ...route('POST /orders'), async (req, res) => {
    const { actor } = await current(req);
    if (actor.role !== 'STUDENT') throw new AppError(403, 'STUDENT_REQUIRED', 'Only students can place orders.');
    const value = key(req);
    const body = { expectedVersion: req.body.expectedVersion, pickupAt: req.body.pickupAt, quote: req.body.quote };
    const hash = requestHash(body);
    const result = await orderTransaction(db, config.DB_TIMEOUT_MS, async tx => {
      // Shared lock order: user -> cart -> canteen -> sorted menu items/categories -> new order.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
      await createSessionReader(config, tx)(req);
      const saved = await replay(tx, actor.id, 'CREATE_ORDER', value, hash);
      if (saved) return saved; // Replays precede cart/pickup checks, including after midnight.
      const claim = await tx.idempotencyKey.create({ data: { actorId: actor.id, action: 'CREATE_ORDER', key: value, requestHash: hash } });
      const initial = await tx.cart.findUnique({ where: { studentId: actor.id } });
      if (!initial?.canteenId) throw new AppError(409, 'CART_EMPTY', 'Add items to your cart before ordering.');
      await tx.$queryRaw`SELECT id FROM carts WHERE id = ${initial.id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${initial.canteenId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT m.id FROM menu_items m JOIN cart_items c ON c.menu_item_id = m.id WHERE c.cart_id = ${initial.id}::uuid ORDER BY m.id FOR UPDATE OF m`;
      await tx.$queryRaw`SELECT c.id FROM menu_categories c WHERE c.id IN (SELECT m.category_id FROM menu_items m JOIN cart_items l ON l.menu_item_id = m.id WHERE l.cart_id = ${initial.id}::uuid) ORDER BY c.id FOR SHARE`;
      const cart = await tx.cart.findUniqueOrThrow({ where: { id: initial.id }, include: cartInclude });
      const summary = cartResponse(cart, config);
      if (cart.version !== body.expectedVersion) throw new AppError(409, 'CART_CHANGED', 'Your cart changed. Review the updated cart.', { cart: summary });
      if (!cart.items.length) throw new AppError(409, 'CART_EMPTY', 'Add items to your cart before ordering.');
      verifyCartQuote(body.quote, summary, actor.id, config);
      const now = await serverNow(tx, options);
      const pickupAt = pickupTime(body.pickupAt, now);
      const orderId = await allocateOrder(tx, { studentId: actor.id, canteenId: cart.canteenId!, totalPaise: summary.totalPaise, pickupAt, now }, options);
      await tx.orderItem.createMany({ data: cart.items.map(line => ({
        orderId, menuItemId: line.menuItemId, name: line.menuItem.name, quantity: line.quantity, unitPricePaise: line.menuItem.pricePaise,
      })) });
      await event(tx, orderId, actor.id, null, 'RECEIVED', now);
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { canteenId: null, version: { increment: 1 } } });
      return complete(tx, claim.id, orderId, 201);
    });
    res.status(result.status).json(result.body);
  });

  const transitions = { accept: ['RECEIVED', 'ACCEPTED'], prepare: ['ACCEPTED', 'PREPARING'], ready: ['PREPARING', 'READY'] } as const;
  for (const [action, [before, after]] of Object.entries(transitions)) {
    router.post('/orders/:id/' + action, ...route('POST /orders/:id/' + action), async (req, res) => {
      const { actor } = await current(req);
      if (actor.role !== 'CANTEEN' || !actor.canteenId) throw new AppError(403, 'CANTEEN_REQUIRED', 'Canteen access is required.');
      const value = key(req); const id = res.locals.params.id;
      const hash = requestHash({ orderId: id, expectedVersion: req.body.expectedVersion });
      const scope = 'ORDER_' + action.toUpperCase();
      const result = await orderTransaction(db, config.DB_TIMEOUT_MS, async tx => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${actor.canteenId}::uuid FOR UPDATE`;
        await createSessionReader(config, tx)(req);
        const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM orders WHERE id = ${id}::uuid AND canteen_id = ${actor.canteenId}::uuid FOR UPDATE`;
        if (!locked.length) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found for your canteen.');
        const saved = await replay(tx, actor.id, scope, value, hash);
        if (saved) return saved;
        const order = await tx.order.findUniqueOrThrow({ where: { id } });
        if (order.version !== req.body.expectedVersion || order.status !== before) {
          const fresh = await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
          throw new AppError(409, 'ORDER_STATE_CONFLICT', 'This order changed. Refresh it before continuing.', { order: orderResponse(fresh) });
        }
        const claim = await tx.idempotencyKey.create({ data: { actorId: actor.id, action: scope, key: value, requestHash: hash } });
        const now = await serverNow(tx, options);
        await tx.order.update({ where: { id }, data: { status: after, version: { increment: 1 }, updatedAt: now } });
        if (after === 'READY') await ensurePickupCredential(tx, id, config.OTP_SECRET);
        await event(tx, id, actor.id, before, after, now);
        return complete(tx, claim.id, id, 200);
      });
      res.status(result.status).json(result.body);
    });
  }

  router.get('/orders/:id/pickup-code', ...route('GET /orders/:id/pickup-code'), async (req, res) => {
    const { actor } = await current(req);
    if (actor.role !== 'STUDENT') throw new AppError(403, 'STUDENT_REQUIRED', 'Pickup codes are only visible to the student who placed the order.');
    const result = await orderTransaction(db, config.DB_TIMEOUT_MS, async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
      await createSessionReader(config, tx)(req);
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM orders WHERE id = ${res.locals.params.id}::uuid AND student_id = ${actor.id}::uuid FOR UPDATE`;
      if (!locked.length) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      const order = await tx.order.findUniqueOrThrow({ where: { id: res.locals.params.id } });
      if (order.status !== 'READY') return { code: null };
      // Existing READY orders from before this release receive their code on first access.
      const credential = await ensurePickupCredential(tx, order.id, config.OTP_SECRET);
      return { code: decryptPickupCode(credential.encryptedCode, order.id, config.OTP_SECRET) };
    });
    res.json(result);
  });

  router.post('/orders/:id/collect', ...route('POST /orders/:id/collect'), async (req, res) => {
    const { actor } = await current(req);
    if (actor.role !== 'CANTEEN' || !actor.canteenId) throw new AppError(403, 'CANTEEN_REQUIRED', 'Only the owning canteen can verify pickup.');
    const value = key(req); const id = res.locals.params.id;
    const action = 'ORDER_COLLECT';
    const hash = collectionRequestHash({ orderId: id, expectedVersion: req.body.expectedVersion, code: req.body.code }, config.OTP_SECRET);
    const result = await orderTransaction(db, config.DB_TIMEOUT_MS, async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${actor.canteenId}::uuid FOR UPDATE`;
      await createSessionReader(config, tx)(req);
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM orders WHERE id = ${id}::uuid AND canteen_id = ${actor.canteenId}::uuid FOR UPDATE`;
      if (!locked.length) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found for your canteen.');
      const saved = await replay(tx, actor.id, action, value, hash);
      if (saved) return { ...saved, error: null };
      const order = await tx.order.findUniqueOrThrow({ where: { id } });
      if (order.status === 'COLLECTED') throw new AppError(409, 'ORDER_ALREADY_COLLECTED', 'This order has already been collected.', { order: orderResponse(await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude })) });
      if (order.status !== 'READY' || order.version !== req.body.expectedVersion) throw new AppError(409, 'ORDER_STATE_CONFLICT', 'Only a ready order at its current version can be collected.', { order: orderResponse(await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude })) });
      const now = await serverNow(tx, options);
      const credential = await ensurePickupCredential(tx, id, config.OTP_SECRET);
      const rateKey = pickupStaffRateKey(actor.id, config.OTP_SECRET);
      const staffRate = await tx.rateLimit.findUnique({ where: { key: rateKey } });
      const orderFailures = credential.windowEndsAt > now ? credential.failedAttempts : 0;
      const staffFailures = staffRate && staffRate.windowEndsAt > now ? staffRate.count : 0;
      const blockedUntil = orderFailures >= pickupFailureLimit ? credential.windowEndsAt : staffFailures >= pickupStaffFailureLimit ? staffRate!.windowEndsAt : null;
      if (blockedUntil) return { error: new AppError(429, 'PICKUP_RATE_LIMITED', 'Too many incorrect pickup codes. Please wait before trying again.', { retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)) }) };
      if (!matchesPickupCode(credential.encryptedCode, req.body.code, id, config.OTP_SECRET)) {
        const orderWindow = orderFailures && orderFailures + 1 < pickupFailureLimit ? credential.windowEndsAt : new Date(now.getTime() + pickupWindowMs);
        const staffWindow = staffFailures && staffFailures + 1 < pickupStaffFailureLimit ? staffRate!.windowEndsAt : new Date(now.getTime() + pickupWindowMs);
        await tx.pickupCredential.update({ where: { orderId: id }, data: { failedAttempts: orderFailures + 1, windowEndsAt: orderWindow } });
        await tx.rateLimit.upsert({ where: { key: rateKey }, create: { key: rateKey, count: 1, windowEndsAt: staffWindow }, update: { count: staffFailures + 1, windowEndsAt: staffWindow } });
        await tx.auditLog.create({ data: { actorId: actor.id, action: 'PICKUP_VERIFY_FAILED', target: `order:${id}`, requestId: res.locals.requestId, createdAt: now, metadata: { reason: 'CODE_MISMATCH' } } });
        const limited = orderFailures + 1 >= pickupFailureLimit || staffFailures + 1 >= pickupStaffFailureLimit;
        // Return errors from the transaction so failed-attempt counters and audit records commit.
        return { error: limited
          ? new AppError(429, 'PICKUP_RATE_LIMITED', 'Too many incorrect pickup codes. Please wait before trying again.', { retryAfterSeconds: Math.max(1, Math.ceil(((orderFailures + 1 >= pickupFailureLimit ? orderWindow : staffWindow).getTime() - now.getTime()) / 1000)) })
          : new AppError(422, 'PICKUP_CODE_MISMATCH', 'That pickup code does not match. Ask the student for the pickup code shown on their ready order.') };
      }
      const claim = await tx.idempotencyKey.create({ data: { actorId: actor.id, action, key: value, requestHash: hash } });
      await tx.order.update({ where: { id }, data: { status: 'COLLECTED', version: { increment: 1 }, collectedAt: now, pickupVerifiedBy: actor.id, updatedAt: now } });
      await tx.pickupCredential.delete({ where: { orderId: id } });
      await event(tx, id, actor.id, 'READY', 'COLLECTED', now);
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'ORDER_COLLECTED', target: `order:${id}`, requestId: res.locals.requestId, createdAt: now } });
      return { ...await complete(tx, claim.id, id, 200), error: null };
    });
    if (result.error) {
      if (result.error.status === 429) res.setHeader('Retry-After', String((result.error.details as { retryAfterSeconds: number }).retryAfterSeconds));
      throw result.error;
    }
    res.status(result.status!).json(result.body);
  });

  function scope(actor: Actor): Prisma.OrderWhereInput {
    if (actor.role === 'STUDENT') return { studentId: actor.id };
    if (actor.role === 'CANTEEN') return { canteenId: actor.canteenId! };
    if (actor.role === 'ADMIN') return {};
    throw new AppError(403, 'ROLE_DENIED', 'Order access is unavailable.');
  }
  router.get('/orders/:id', ...route('GET /orders/:id'), async (req, res) => {
    const { actor } = await current(req);
    const order = await db.order.findFirst({ where: { ...scope(actor), id: res.locals.params.id }, include: orderInclude });
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    res.json(orderResponse(order));
  });
  router.get('/orders', ...route('GET /orders'), async (req, res) => {
    const { actor } = await current(req);
    const q = res.locals.query as { cursor?: string; limit: number; canteenId?: string; status?: OrderStatus; search?: string; from?: string; to?: string };
    if (actor.role === 'CANTEEN' && q.canteenId && q.canteenId !== actor.canteenId) throw new AppError(403, 'CANTEEN_DENIED', 'You can only view your own canteen orders.');
    if (q.from && q.to && q.from > q.to) throw new AppError(422, 'DATE_RANGE_INVALID', 'The start date must precede the end date.');
    const where: Prisma.OrderWhereInput = { AND: [scope(actor), { ...(q.canteenId ? { canteenId: q.canteenId } : {}), ...(q.status ? { status: q.status } : {}),
      ...((q.from || q.to) ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
      ...(q.search ? { OR: [{ orderCode: { contains: q.search, mode: 'insensitive' } }, { canteen: { name: { contains: q.search, mode: 'insensitive' } } }, { items: { some: { name: { contains: q.search, mode: 'insensitive' } } } }] } : {}) }] };
    const page = await db.$transaction(async tx => {
      let after: Prisma.OrderWhereInput = {};
      if (q.cursor) {
        const cursor = await tx.order.findFirst({ where: { AND: [where, { id: q.cursor }] } });
        if (!cursor) throw new AppError(422, 'CURSOR_INVALID', 'Refresh the order list before loading more.');
        after = actor.role === 'CANTEEN' ? { OR: [{ pickupAt: { gt: cursor.pickupAt } }, { pickupAt: cursor.pickupAt, createdAt: { gt: cursor.createdAt } }, { pickupAt: cursor.pickupAt, createdAt: cursor.createdAt, id: { gt: cursor.id } }] }
          : { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] };
      }
      const rows = await tx.order.findMany({ where: { AND: [where, after] }, orderBy: actor.role === 'CANTEEN'
        ? [{ pickupAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1, include: orderInclude });
      return { items: rows.slice(0, q.limit).map(orderResponse), nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null };
    }, { maxWait: config.DB_TIMEOUT_MS, timeout: 15000, isolationLevel: 'RepeatableRead' });
    res.json(page);
  });
  return router;
}
