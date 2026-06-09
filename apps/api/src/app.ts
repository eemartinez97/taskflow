import { corsMiddleware } from "./middleware/cors.js";
import { helmetMiddleware } from "./middleware/helmet.js";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { defaultRateLimiter } from "./middleware/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";

/** Creates and configures the Express application
 * Exported separately from the HTTP server so tests can import
 * the app without binding to a port
 */
export function createApp(): Express {
  const app = express();

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
      // Skip health-check probes to reduce log noise
      autoLogging: {
        ignore: (req) => req.url === "/healthz" || req.url === "/readyz",
      },
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

  // Catch-all 404
  app.all("/{*splat}", (_req, res) => {
    res.status(404).json({ error: { message: "Not found", code: "NOT_FOUND" } });
  });

  // Centralized error handler (must be last)
  app.use(errorHandler);

  return app;
}
