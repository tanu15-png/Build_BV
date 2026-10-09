import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("Request failed", {
    requestId: res.locals.requestId,
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong.",
      requestId: res.locals.requestId,
    },
  });
}