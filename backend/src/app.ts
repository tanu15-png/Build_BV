import { createAdminRouter } from './routes/admin.routes.js';
import { createCatalogEvents } from './services/catalogEvents.js';
import { createNotificationsRouter } from './routes/notifications.routes.js';
import { createOrdersRouter } from './routes/orders.routes.js';
import type { OrderOptions } from './services/orders.js';
import { createCatalogRouter } from './routes/catalog.routes.js';
import express, { Router } from 'express';
import type { Config } from './config/env.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { requestId } from './middleware/requestId.js';
import { createHealthRouter } from './routes/health.routes.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';
import { canteenSchema } from './schemas/contracts.js';
import { createAuthRouter } from './routes/auth.routes.js';
function allowsOrigin(origin: string, config: Config): boolean {
  if (origin === config.FRONTEND_ORIGIN) return true;
  if (config.APP_ENV !== 'development' || config.NODE_ENV !== 'development') return false;
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  try {
    const candidate = new URL(origin);
    const configured = new URL(config.FRONTEND_ORIGIN);
    return candidate.origin === origin && loopbackHosts.has(candidate.hostname) &&
      loopbackHosts.has(configured.hostname) && candidate.protocol === configured.protocol &&
      candidate.port === configured.port;
  } catch { return false; }
}
export function createApp(config: Config, db: PrismaClient,
  log: (entry: object) => void = entry => console.log(JSON.stringify(entry)), authFetch: typeof fetch = fetch, orderOptions: OrderOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => { if (config.LOG_LEVEL !== 'silent') log({ requestId: res.locals.requestId,
      method: req.method, status: res.statusCode, durationMs: Date.now() - started }); });
    const origin = req.get('origin');
    if (origin && !allowsOrigin(origin, config)) return next(new AppError(403, 'ORIGIN_DENIED', 'Origin is not allowed.'));
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token,X-Request-Id,Idempotency-Key');
      res.status(204).end(); return;
    }
    next();
  });
  app.use(express.json({ limit: config.JSON_LIMIT_BYTES, strict: true }));
  app.use('/health', createHealthRouter(() => db.$queryRawUnsafe('SELECT 1'), config.DB_TIMEOUT_MS));
  const api = Router();
  api.get('/canteens', async (_req, res) => {
    const rows = await db.canteen.findMany({ orderBy: { slug: 'asc' }, select: {
      id: true, slug: true, name: true, location: true, hours: true, acceptingOrders: true, operational: true, version: true } });
    res.json({ canteens: rows.map(row => canteenSchema.parse(row)) });
  });
  api.use(createAuthRouter(config, db, authFetch));
  const catalogEvents = createCatalogEvents();
  api.use(createCatalogRouter(config, db, catalogEvents));
  api.use(createAdminRouter(config, db, catalogEvents));
  api.use(createNotificationsRouter(config, db));
  api.use(createOrdersRouter(config, db, orderOptions));
  app.use('/api/v1', api);
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Resource not found.')));
  app.use(errorHandler);
  return app;
}
