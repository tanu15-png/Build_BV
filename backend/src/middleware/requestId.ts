import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function requestId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const incomingId = req.header('X-Request-Id');

  const id = incomingId || randomUUID();

  res.setHeader('X-Request-Id', id);
  res.locals.requestId = id;

  next();
}