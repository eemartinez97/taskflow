import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger.js";
import { isProduction } from "../config/env.js";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Express 5 centralized error handler
 * Must have exactly 4 parameters for Express to treat it as an error middleware.
 * Express 5: rejected promises from async routes automatically flow here
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const isProd = isProduction();

  logger.error(
    {
      err: {
        message: err.message,
        code: err.code,
        stack: isProd ? undefined : err.stack,
      },
      statusCode,
    },
    "Request error",
  );

  // Mask internal error details in production to prevent information leakage
  const message = isProd && statusCode === 500 ? "Internal server error" : err.message;

  res.status(statusCode).json({
    error: {
      message,
      code: err.code ?? "INTERNAL_ERROR",
    },
  });
}

/** Convenience factory for creating typed application errors. */
export function createError(message: string, statusCode: number, code?: string): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;

  if (code !== undefined) err.code = code;

  return err;
}
