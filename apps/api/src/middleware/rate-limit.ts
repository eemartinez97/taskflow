import rateLimit, { type Options, type RateLimitRequestHandler } from "express-rate-limit";

import { isProduction } from "../config/env";

/**
 * Base configuration shared by all rate limiters.
 * Use createRateLimiter() to create an instance with custom limits.
 */
const BASE_OPTIONS = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
} satisfies Partial<Options>;

interface RateLimiterOptions {
  /** Time window in milliseconds. */
  windowMs: number;
  /** Max requests allowed per window per IP. */
  limit: number;
  /** Human-readable message sent in the 429 response body. */
  message?: string;
}

/**
 * Factory that creates a rate limiter middleware with shared base config.
 * Swap the default MemoryStore for rate-limit-redis in distributed deployments
 * without changing any call sites.
 */
export function createRateLimiter({
  windowMs,
  limit,
  message = "Too many requests, please try again later.",
}: RateLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    ...BASE_OPTIONS,
    windowMs,
    limit,
    message: { error: { message, code: "RATE_LIMITED" } },
  });
}

/** 100 req / 15 min - applied globally. */
export const defaultRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: isProduction() ? 100 : 1000,
});
