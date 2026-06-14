import pino from "pino";
import { env, isProduction } from "./env.js";

/**
 * Pino 10 structured logger.
 * Development: pino-pretty transport for human-readable output
 * Production: raw JSON to stdout (collected by log aggregator)
 */
export const logger = pino({
  level: env.API_LOG_LEVEL,
  // In production emit raw JSON - no transport overhead
  ...(isProduction()
    ? {} // v8 ignore next
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorized: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),
});

export type Logger = typeof logger;
