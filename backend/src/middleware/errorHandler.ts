import type { NextFunction, Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}

export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  const isServerError = status >= 500;
  const message = isServerError ? "Internal Server Error" : err.message;
  const code = err.code ?? (isServerError ? "INTERNAL_SERVER_ERROR" : undefined);

  if (isServerError) {
    // eslint-disable-next-line no-console
    console.error("Unhandled error", err);
  }

  res.status(status).json({
    error: {
      code,
      message,
    },
  });
}
