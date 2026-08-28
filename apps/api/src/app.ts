import * as trpcExpress from "@trpc/server/adapters/express";
import { corsMiddleware } from "./middleware/cors";
import { helmetMiddleware } from "./middleware/helmet";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger";
import { defaultRateLimiter } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error-handler";
import { createAppRouter } from "./trpc/router";
import { createTRPCContext, TRPCError } from "./trpc/init";
import { appCollectors, appRegistry, createMetricsMiddleware } from "./metrics";
import { env, isProduction } from "./config/env";
import { testRouter } from "./routes/test";
import type { AppServer } from "./socket/events";

export function isHealthCheckUrl(url: string | undefined): boolean {
  return url === "/healthz" || url === "/readyz";
}

/**
 * Every top-level path this Express app actually serves (Socket.IO's
 * /socket.io/* is handled separately, outside Express - see server.ts).
 *
 * infrastructure/nginx/nginx.conf proxies exactly this set to the api
 * container and sends everything else to web - a route added here without
 * also adding it below AND to nginx.conf would silently fall through to
 * web and 404. tests/unit/infra/nginx-route-sync.test.ts checks this array
 * against nginx.conf's `location` blocks; keep them in sync when adding a
 * new top-level route.
 */
export const PROXIED_API_PATHS = ["/metrics", "/healthz", "/readyz", "/trpc", "/api/test"] as const;

/**
 * Extracted so it can be unit-tested independently
 * Called by the tRPC Express adapter's `onError` hook
 *
 * Logs the ORIGINAL thrown error (error.cause - tRPC wraps any non-TRPCError
 * throw into a TRPCError with code INTERNAL_SERVER_ERROR and sets cause to
 * whatever was actually thrown), not just the path. Without this, every
 * unexpected failure - a downstream API call rejecting, a bug - showed up
 * in the logs as nothing more than "tRPC internal server error", with the
 * real reason (and stack trace) nowhere to be found. The client-facing
 * message stays generic on purpose (see trpc/init.ts's errorFormatter,
 * which strips `cause` in production) - this only widens what apps/api
 * itself logs server-side, never what a browser can see.
 */
export function handleTRPCError({
  path,
  error,
}: {
  path: string | undefined;
  error: unknown;
}): void {
  if (error instanceof TRPCError && error.code === "INTERNAL_SERVER_ERROR") {
    logger.error({ path, err: error.cause ?? error }, "tRPC internal server error");
  }
}

/** Creates and configures the Express application
 * Exported separately from the HTTP server so tests can import
 * the app without binding to a port
 */
export function createApp(io: AppServer): Express {
  const app = express();

  const router = createAppRouter(io);

  // Behind nginx in Docker/prod, req.ip and X-Forwarded-For based rate
  // limiting would otherwise see nginx's own IP for every client. Must be
  // set before defaultRateLimiter is mounted. Delegates the actual
  // "trust N hops" algorithm to Express's `proxy-addr`/`forwarded`
  // dependencies - apps/web/lib/http/client-ip.ts implements the same
  // algorithm independently (it cannot depend on this Express-only path;
  // see that file's docblock for why) - keep both in sync by spec, not by
  // shared code, if this algorithm ever changes.
  app.set("trust proxy", env.TRUSTED_PROXY_HOPS);

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

  // Prometheus request metrics
  app.use(createMetricsMiddleware(appCollectors));

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

  // Prometheus scrape endpoint
  app.get("/metrics", async (req, res) => {
    // Scrapes come from the custer; never expose route topology publicly.
    if (
      isProduction() &&
      (!env.METRICS_TOKEN || req.headers.authorization !== `Bearer ${env.METRICS_TOKEN}`)
    ) {
      res.status(404).end();
      return;
    }
    res.set("Content-Type", appRegistry.contentType);
    res.end(await appRegistry.metrics());
  });

  // Health endpoints
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/readyz", (_req, res) => {
    res.status(200).json({ status: "ready" });
  });

  // Global rate limiting
  app.use(defaultRateLimiter);

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

  // E2E-only backdoor routes - always mounted, 404'd per-request by their
  // own guard unless isAuthorizedE2ERequest() passes (see routes/test.ts).
  app.use("/api/test", testRouter);

  // Catch-all 404
  app.all("/{*splat}", (_req, res) => {
    res.status(404).json({ error: { message: "Not found", code: "NOT_FOUND" } });
  });

  // Centralized error handler (must be last)
  app.use(errorHandler);

  return app;
}
