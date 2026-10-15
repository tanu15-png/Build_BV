import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './errorHandler.js';
export function validate(schema: ZodType, source: 'body' | 'params' | 'query' = 'body'): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return next(new AppError(422, 'VALIDATION_ERROR', `Invalid request ${source}.`,
      { fields: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code })) }));
    res.locals[source] = parsed.data;
    if (source === 'body') req.body = parsed.data;
    next();
  };
}
export const validateBody = (schema: ZodType) => validate(schema);
