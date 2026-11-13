import { createReadCache } from '../services/readCache.js';
import { z } from 'zod';
import { Router } from 'express';
import type { Config } from '../config/env.js';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { createSessionReader } from '../services/session.js';
import { AppError } from '../middleware/errorHandler.js';
import { allocateOrder, orderTransaction, orderInclude, orderResponse } from '../services/orders.js';

// Per-order earning; every redemption keeps its original token price.
export async function tokenSummary(tx: Prisma.TransactionClient | PrismaClient, studentId: string) {
  const rows = await tx.order.findMany({ where: { studentId, canteen: { slug: 'canteen' } }, select: { totalPaise: true, status: true, executionMode: true, rewardTokenCost: true } });
  const earned = rows.filter(o => o.status === 'COLLECTED' && o.executionMode !== 'REWARD').reduce((sum, o) => sum + Math.floor(o.totalPaise / 1000), 0);
  const spent = rows.filter(o => o.executionMode === 'REWARD' && o.status !== 'REJECTED').reduce((sum, o) => sum + (o.rewardTokenCost ?? 100), 0);
  return { earned, spent, balance: earned - spent };
}
export function createRewardsRouter(config: Config, db: PrismaClient, reads = createReadCache()) {
  const router = Router(), current = createSessionReader(config, db);
  router.get('/rewards', async (req, res) => {
    const { actor } = await current(req);
    const result = await reads.get(`rewards:${actor.role}:${actor.id}:${actor.canteenId || ''}`, async () => {
    const rewards = await db.reward.findMany({ where: { canteen: { slug: 'canteen' }, ...(actor.role === 'STUDENT' ? { active: true, menuItem: { archived: false, available: true, category: { archived: false } } } : {}) }, include: { menuItem: true }, orderBy: [{ tokenCost: 'asc' }, { id: 'asc' }] });
    if (actor.role === 'STUDENT') return { ...await tokenSummary(db, actor.id), rewards };
    if (actor.role !== 'CANTEEN') throw new AppError(403, 'ROLE_DENIED', 'Canteen access required.');
    const orders = await db.order.findMany({ where: { canteenId: actor.canteenId!, canteen: { slug: 'canteen' } }, select: { totalPaise: true, status: true, executionMode: true, rewardTokenCost: true } });
    return { earned: orders.filter(o => o.status === 'COLLECTED' && o.executionMode !== 'REWARD').reduce((s,o) => s + Math.floor(o.totalPaise / 1000),0), redemptions: orders.filter(o => o.executionMode === 'REWARD' && o.status !== 'REJECTED').length, rewards };
    }, 10000, req.get('Cache-Control') === 'no-cache');
    res.json(result);
  });
  router.post('/rewards/redeem', async (req, res) => {
    const { actor } = await current(req);
    if (actor.role !== 'STUDENT') throw new AppError(403, 'STUDENT_REQUIRED', 'Student access required.');
    const parsed = z.object({ rewardId: z.uuid(), expectedTokenCost: z.number().int().positive() }).safeParse(req.body);
    if (!parsed.success) throw new AppError(422, 'REWARD_INVALID', 'Choose a valid reward.');
    const { rewardId, expectedTokenCost } = parsed.data;
    const fingerprint = `${rewardId}:${expectedTokenCost}`;
    const key = req.get('Idempotency-Key');
    if (!key || !/^[A-Za-z0-9:_-]{16,128}$/.test(key)) throw new AppError(422, 'KEY_REQUIRED', 'A retry key is required.');
    const result = await orderTransaction(db, config.DB_TIMEOUT_MS, async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
      await createSessionReader(config, tx)(req);
      const previous = await tx.idempotencyKey.findUnique({ where: { actorId_action_key: { actorId: actor.id, action: 'REDEEM_REWARD_V2', key } } });
      if (previous && previous.requestHash !== fingerprint) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This retry key belongs to another reward.');
      if (previous?.response) return previous.response;
      const canteen = await tx.canteen.findUniqueOrThrow({ where: { slug: 'canteen' } });
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${canteen.id}::uuid FOR UPDATE`;
      if (!canteen.operational || !canteen.acceptingOrders) throw new AppError(409, 'CANTEEN_PAUSED', 'Reward orders are currently paused.');
      const reward = await tx.reward.findFirst({ where: { id: rewardId, canteenId: canteen.id, active: true }, include: { menuItem: { include: { category: true } } } });
      if (reward && reward.tokenCost !== expectedTokenCost) throw new AppError(409, 'REWARD_PRICE_CHANGED', 'The token price changed. Refresh rewards before redeeming.');
      if (!reward) throw new AppError(409, 'REWARD_UNAVAILABLE', 'This reward is no longer available.');
      await tx.$queryRaw`SELECT id FROM menu_items WHERE id = ${reward.menuItemId}::uuid FOR SHARE`;
      const item = await tx.menuItem.findUniqueOrThrow({ where: { id: reward.menuItemId }, include: { category: true } });
      if (item.archived || !item.available || item.category.archived) throw new AppError(409, 'REWARD_UNAVAILABLE', 'This reward item is unavailable.');
      if ((await tokenSummary(tx, actor.id)).balance < reward.tokenCost) throw new AppError(409, 'TOKENS_INSUFFICIENT', `You need ${reward.tokenCost} tokens for this reward.`);
      const now = new Date();
      const id = await allocateOrder(tx, { studentId: actor.id, canteenId: canteen.id, totalPaise: 0, pickupAt: now, now }, {});
      await tx.order.update({ where: { id }, data: { executionMode: 'REWARD', rewardTokenCost: reward.tokenCost } });
      await tx.orderItem.create({ data: { orderId: id, menuItemId: item.id, name: `${item.name} · ${reward.tokenCost}-token reward`, quantity: 1, unitPricePaise: 0 } });
      const event = await tx.orderEvent.create({ data: { orderId: id, actorId: actor.id, newStatus: 'RECEIVED' } });
      await tx.outboxEvent.create({ data: { eventId: event.id, payload: { type: 'ORDER_STATUS_CHANGED', orderId: id, previousStatus: null, status: 'RECEIVED', occurredAt: now.toISOString() } } });
      const response = orderResponse(await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude }));
      await tx.idempotencyKey.create({ data: { actorId: actor.id, action: 'REDEEM_REWARD_V2', key, requestHash: fingerprint, state: 'COMPLETED', orderId: id, responseStatus: 201, response } });
      return response;
    });
    res.status(201).json(result);
  });
  router.post('/rewards/manage', async (req, res) => {
    const { actor } = await current(req);
    if (actor.role !== 'CANTEEN') throw new AppError(403, 'CANTEEN_REQUIRED', 'Only the canteen can manage rewards.');
    const parsed = z.object({ menuItemId: z.uuid(), tokenCost: z.number().int().min(1).max(1000000), active: z.boolean().default(true) }).safeParse(req.body);
    if (!parsed.success) throw new AppError(422, 'REWARD_INVALID', 'Choose a menu item and a whole token price between 1 and 1,000,000.');
    const result = await orderTransaction(db, config.DB_TIMEOUT_MS, async tx => {
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${actor.canteenId}::uuid FOR UPDATE`;
      await createSessionReader(config, tx)(req);
      const item = await tx.menuItem.findFirst({ where: { id: parsed.data.menuItemId, canteenId: actor.canteenId!, archived: false } });
      if (!item) throw new AppError(422, 'ITEM_INVALID', 'Choose an item from your own active menu.');
      const { menuItemId, tokenCost, active } = parsed.data;
      return tx.reward.upsert({ where: { menuItemId }, create: { menuItemId, canteenId: actor.canteenId!, tokenCost, active }, update: { tokenCost, active, version: { increment: 1 } } });
    });
    res.json(result);
  });
  router.delete('/rewards/manage/:id', async (req, res) => {
    const { actor } = await current(req);
    if (actor.role !== 'CANTEEN') throw new AppError(403, 'CANTEEN_REQUIRED', 'Only the canteen can manage rewards.');
    const parsed = z.uuid().safeParse(req.params.id);
    if (!parsed.success) throw new AppError(422, 'REWARD_INVALID', 'Choose a valid reward.');
    await orderTransaction(db, config.DB_TIMEOUT_MS, async tx => {
      await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${actor.canteenId}::uuid FOR UPDATE`;
      await createSessionReader(config, tx)(req);
      // Delete only the reward listing. Menu items and historical token deductions remain intact.
      await tx.reward.deleteMany({ where: { id: parsed.data, canteenId: actor.canteenId! } });
    });
    res.json({ ok: true });
  });
  return router;
}
