import { Router } from 'express';
import type { Config } from '../config/env.js';
import type { PrismaClient, Prisma, Notification } from '../generated/prisma/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { contracts } from '../schemas/contracts.js';
import { createSessionReader } from '../services/session.js';
const response = (row: Notification) => ({ id: row.id, orderId: row.orderId, type: row.type, message: row.message,
  createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null });
export function createNotificationsRouter(config: Config, db: PrismaClient) {
  const router = Router();
  const current = createSessionReader(config, db);
  const txOptions = { maxWait: config.DB_TIMEOUT_MS, timeout: 15000 };
  router.get('/notifications', validate(contracts['GET /notifications']!.query, 'query'), async (req, res) => {
    const { actor } = await current(req);
    if (actor.role !== 'STUDENT') throw new AppError(403, 'STUDENT_REQUIRED', 'Student notifications are only available to students.');
    const { cursor, limit } = res.locals.query as { cursor?: string; limit: number };
    const page = await db.$transaction(async tx => {
      let after: Prisma.NotificationWhereInput = {};
      if (cursor) {
        const row = await tx.notification.findFirst({ where: { id: cursor, recipientId: actor.id } });
        if (!row) throw new AppError(422, 'CURSOR_INVALID', 'Refresh your notifications before loading more.');
        after = { OR: [{ createdAt: { lt: row.createdAt } }, { createdAt: row.createdAt, id: { lt: row.id } }] };
      }
      const rows = await tx.notification.findMany({ where: { AND: [{ recipientId: actor.id }, after] },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 });
      const unreadCount = await tx.notification.count({ where: { recipientId: actor.id, readAt: null } });
      return { items: rows.slice(0, limit).map(response), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null, unreadCount };
    }, { ...txOptions, isolationLevel: 'RepeatableRead' });
    res.json(page);
  });
  const readContract = contracts['PATCH /notifications/:id/read']!;
  router.patch('/notifications/:id/read', validate(readContract.params, 'params'), validate(readContract.body), async (req, res) => {
    const { actor } = await current(req);
    if (actor.role !== 'STUDENT') throw new AppError(403, 'STUDENT_REQUIRED', 'Student notifications are only available to students.');
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`;
      await createSessionReader(config, tx)(req);
      await tx.notification.updateMany({ where: { id: res.locals.params.id, recipientId: actor.id, readAt: null }, data: { readAt: new Date() } });
      const row = await tx.notification.findFirst({ where: { id: res.locals.params.id, recipientId: actor.id } });
      if (!row) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
      return response(row);
    }, txOptions);
    res.json(result);
  });
  return router;
}
