import * as trpcExpress from "@trpc/server/adapters/express";
import { corsMiddleware } from "./middleware/cors.js";
import { helmetMiddleware } from "./middleware/helmet.js";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { defaultRateLimiter } from "./middleware/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAppRouter } from "./trpc/router.js";
import { createTRPCContext, TRPCError } from "./trpc/init.js";
import { type Server } from "socket.io";

export function isHealthCheckUrl(url: string | undefined): boolean {
  return url === "/healthz" || url === "/readyz";
}

/**
 * Extracted so it can be unit-tested independently
 * Called by the tRPC Express adapter's `onError` hook
 */
export function handleTRPCError({
  path,
  error,
}: {
  path: string | undefined;
  error: unknown;
}): void {
  if (error instanceof TRPCError && error.code === "INTERNAL_SERVER_ERROR") {
    logger.error({ path }, "tRPC internal server error");
  }
}

/** Creates and configures the Express application
 * Exported separately from the HTTP server so tests can import
 * the app without binding to a port
 */
export function createApp(io: Server): Express {
  const app = express();

  const router = createAppRouter(io);

  // Security headers
  app.use(helmetMiddleware);

  // CORS - must come before other middleware so preflight OPTIONS is handled
  app.use(corsMiddleware);

  /** Express 5: query parser defaults to 'simple' - correct for our use case.
   * Set to 'extended' only if nested query objects are needed
   */
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // HTTP request logging
  app.use(
    pinoHttp({
      logger,
      /* v8 ignore start */
      // Skip health-check probes to reduce log noise
      autoLogging: {
        ignore: (req) => isHealthCheckUrl(req.url),
      },
      /* v8 ignore stop */
    }),
  );

  // Global rate limiting
  app.use(defaultRateLimiter);

  // Health endpoints
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/readyz", (_req, res) => {
    res.status(200).json({ status: "ready" });
  });

  // tRPC
  // Express adapter - handles all POST/GET requests at /trpc/*
  // Each request gets its own context via createTRPCContext.
  // Protected procedures additionally run the validateSession middleware
  // inside the tRPC middleware chain (not at the Express level) so that
  // public procedures like /trpc/healthPing remain unauthenticated.
  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router,
      createContext: createTRPCContext,
      onError: handleTRPCError,
    }),
  );

  // Catch-all 404
  app.all("/{*splat}", (_req, res) => {
    res.status(404).json({ error: { message: "Not found", code: "NOT_FOUND" } });
  });

  // Centralized error handler (must be last)
  app.use(errorHandler);

  return app;
}
