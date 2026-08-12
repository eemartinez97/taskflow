import { logger } from "../config/logger";

/**
 * Runs a promise without blocking the caller on it, logging (not throwing)
 * on failure. For best-effort side effects (realtime broadcasts,
 * notifications, emails) that start after the primary DB write already
 * committed - awaiting them would delay the response behind work the
 * caller doesn't need to wait for, and letting them reject would turn an
 * already-successful mutation into a false failure.
 */
export function fireAndForget(
  promise: Promise<unknown>,
  message: string,
  fields: Record<string, unknown> = {},
): void {
  promise.catch((error: unknown) => {
    logger.error({ err: error, ...fields }, message);
  });
}
