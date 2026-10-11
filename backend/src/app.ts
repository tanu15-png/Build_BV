import express from 'express';
import cors from 'cors';

import { env } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { healthRouter } from './routes/health.routes.js';
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    })
  );

  app.use(
    express.json({
      limit: '100kb',
    })
  );

  app.use(requestId);

  app.use('/health', healthRouter);
  app.use(errorHandler);
  return app;
}