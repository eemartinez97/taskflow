import pino, { type LoggerOptions } from "pino";
import { env, isProduction } from "./env";

/**
 * Pino 10 structured logger.
 * Development: pino-pretty transport for human-readable output
 * Production: raw JSON to stdout (collected by log aggregator)
 */
export function buildLoggerOptions(): LoggerOptions {
  return {
    level: env.API_LOG_LEVEL,
    // In production emit raw JSON - no transport overhead
    ...(isProduction()
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
            },
          },
        }),
  };
}

export const logger = pino(buildLoggerOptions());

export type Logger = typeof logger;
