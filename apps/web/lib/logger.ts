import { serverEnv } from "./env";
import pino from "pino";

/** Maps NODE_ENV to a pino log level. Exported for unit testing. */
export function getLogLevel(nodeEnv: string): "warn" | "debug" {
  return nodeEnv === "production" ? "warn" : "debug";
}

export const logger = pino({ level: getLogLevel(serverEnv.NODE_ENV) });

export type { Logger } from "pino";
