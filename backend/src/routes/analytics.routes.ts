import { Router } from 'express';
import type { Config } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createSessionReader } from '../services/session.js';
import { AppError } from '../middleware/errorHandler.js';
import { analyticsRange, salesStats } from '../services/analytics.js';

export function createAnalyticsRouter(config: Config, db: PrismaClient) {
  const router = Router(), current = createSessionReader(config, db);
  router.get('/stats', async (req, res) => {
    const { actor } = await current(req);
    if (actor.role !== 'CANTEEN' || !actor.canteenId) throw new AppError(403, 'CANTEEN_REQUIRED', 'Canteen access is required.');
    const range = analyticsRange(req.query.period, req.query.date);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(await salesStats(db, actor.canteenId, range));
  });
  return router;
}
