import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  const id = incoming && /^[a-zA-Z0-9_-]{1,80}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', id);
  res.locals.requestId = id;
  next();
};
