import type { ErrorRequestHandler } from 'express';
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) return _next(error);
  let mapped = error instanceof AppError ? error : new AppError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong.');
  if (error?.type === 'entity.parse.failed') mapped = new AppError(422, 'INVALID_JSON', 'Invalid JSON body.');
  if (error?.type === 'entity.too.large') mapped = new AppError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
  if (error?.code === 'P2002') mapped = new AppError(409, 'CONFLICT', 'A record already exists.');
  if (error?.code === 'P2025') mapped = new AppError(404, 'NOT_FOUND', 'Resource not found.');
  if (['P1001', 'P1002', 'P2024'].includes(error?.code)) mapped = new AppError(503, 'UNAVAILABLE', 'Service temporarily unavailable.');
  res.status(mapped.status).json({ error: { code: mapped.code, message: mapped.message,
    ...(mapped.details === undefined ? {} : { details: mapped.details }), requestId: res.locals.requestId } });
};
