import { createOffersRouter } from './routes/offers.routes.js';
import { createAnalyticsRouter } from './routes/analytics.routes.js';
import { createBannersRouter } from './routes/banners.routes.js';
import { createReadCache } from './services/readCache.js';
import { portals, portalOrigin, setPortal, type Portal } from './services/portal.js';
import { createRewardsRouter } from './routes/rewards.routes.js';
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
function allowsOrigin(origin: string, config: Config, portal?: Portal): boolean {
  const allowed = portal ? [portalOrigin(config, portal)] : portals.map(value => portalOrigin(config, value));
  if (allowed.includes(origin)) return true;
  if (config.APP_ENV !== 'development' || config.NODE_ENV !== 'development') return false;
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  try {
    const candidate = new URL(origin);
    return allowed.some(value => {
      const configured = new URL(value);
      return candidate.origin === origin && loopbackHosts.has(candidate.hostname) &&
        loopbackHosts.has(configured.hostname) && candidate.protocol === configured.protocol && candidate.port === configured.port;
    });
  } catch { return false; }
}
function originDenied(config: Config, portal?: Portal) {
  return new AppError(403, 'ORIGIN_DENIED', portal
    ? `This page address is not allowed. Open ${portalOrigin(config, portal)} for the ${portal} website.`
    : 'Origin is not allowed.');
}
export function createApp(config: Config, db: PrismaClient,
  log: (entry: object) => void = entry => console.log(JSON.stringify(entry)), authFetch: typeof fetch = fetch, orderOptions: OrderOptions = {}) {
  const app = express();
  if (config.TRUST_PROXY_HOPS) app.set('trust proxy', config.TRUST_PROXY_HOPS);
  const reads = createReadCache();
  const catalogEvents = createCatalogEvents();
  app.locals.closeEventStreams = () => catalogEvents.close();
  app.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = body => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && res.statusCode < 400) {
        if (/\/(?:menu-items|menu-categories|canteens|banners|offers)(?:\/|$)/.test(req.originalUrl)) reads.clear();
        else if (/\/(?:orders|rewards)(?:\/|$)/.test(req.originalUrl)) reads.clear('rewards:');
        if (/\/(orders|rewards)(?:\/|$)/.test(req.originalUrl)) catalogEvents.publishRewards();
        if (/\/orders(?:\/|$)/.test(req.originalUrl) || /\/rewards\/redeem(?:\?|$)/.test(req.originalUrl)) catalogEvents.publishOrders();
      }
      return json(body);
    };
    next();
  });
  app.disable('x-powered-by');
  app.use(requestId);
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => { if (config.LOG_LEVEL !== 'silent') log({ requestId: res.locals.requestId,
      method: req.method, status: res.statusCode, durationMs: Date.now() - started }); });
    const origin = req.get('origin');
    const segment = req.path.match(/^\/api\/v1\/(student|canteen|admin)(?:\/|$)/)?.[1] as Portal | undefined;
    if (origin && !allowsOrigin(origin, config, segment)) return next(originDenied(config, segment));
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token,X-Request-Id,Idempotency-Key,Cache-Control');
      res.status(204).end(); return;
    }
    next();
  });
  app.use(express.json({ limit: config.JSON_LIMIT_BYTES, strict: true }));
  app.use('/health', createHealthRouter(() => db.$queryRawUnsafe('SELECT 1'), config.DB_TIMEOUT_MS));
  const api = Router();
  api.get('/canteens', async (_req, res) => {
    const rows = await db.canteen.findMany({ where: { slug: 'canteen' }, orderBy: { slug: 'asc' }, select: {
      id: true, slug: true, name: true, location: true, hours: true, acceptingOrders: true, operational: true, version: true } });
    res.json({ canteens: rows.map(row => canteenSchema.parse(row)) });
  });
  api.use(createAuthRouter(config, db, authFetch));
  api.use(createCatalogRouter(config, db, catalogEvents, reads));
  api.use(createRewardsRouter(config, db, reads));
  api.use(createBannersRouter(config, db, catalogEvents, reads));
  api.use(createOffersRouter(config, db, catalogEvents, reads));
  api.use(createNotificationsRouter(config, db));
  api.use(createOrdersRouter(config, db, orderOptions));
  api.use(createAnalyticsRouter(config, db));
  app.use('/api/v1/:portal', (req, _res, next) => {
    const portal = req.params.portal as Portal;
    if (!portals.includes(portal) || portal === 'admin') return next(new AppError(404, 'PORTAL_REQUIRED', 'Use a portal API address.'));
    // Validate the decoded router parameter as well as the raw path (encoded aliases must not bypass origin scoping).
    const origin = req.get('origin');
    if (origin && !allowsOrigin(origin, config, portal)) return next(originDenied(config, portal));
    setPortal(req, portal);
    next();
  }, api);
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Resource not found.')));
  app.use(errorHandler);
  return app;
}
