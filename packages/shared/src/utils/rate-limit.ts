export interface RateLimitOptions {
  /** Max requests allowed per window for a given key. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimiter {
  /** Returns `true` when `key` already exceeded the limit for its current window. */
  isLimited: (key: string) => boolean;
  /**
   * Opaque handle identifying the window currently open for `key` (or
   * `null` if no bucket exists). Read synchronously right after `isLimited`
   * - same tick, before any other code can roll the window over - and hand
   * it to `release` so a release that runs after that window has already
   * expired safely no-ops instead of decrementing an unrelated later
   * window's count.
   */
  currentWindowToken: (key: string) => number | null;
  /**
   * Gives back one `isLimited` count for `key`, but only if `windowToken`
   * still matches the bucket's current window - a release that arrives
   * after the window rolled over (e.g. a slow failure path racing a
   * legitimate new request) is a no-op rather than stealing quota from
   * whatever request opened the new window.
   *
   * For callers where isLimited() guards an action that can itself fail
   * (e.g. an email send) - so a failed attempt, which delivered nothing,
   * doesn't count against the caller's quota the same as a successful one.
   */
  release: (key: string, windowToken: number | null) => void;
  /** Clears all tracked buckets - exposed for tests. */
  reset: () => void;
}

/**
 * Generic in-memory sliding-window rate limiter factory.
 *
 * Each call to `createRateLimiter()` owns an independent bucket map, so
 * unrelated call sites (e.g. socket presence packets vs. auth email
 * requests) never share or contend on state.
 *
 * CAVEAT: single-process / in-memory. Fine for one server instance; swap
 * the internals for a shared store (Redis/Upstash) before scaling
 * horizontally to multiple instances.
 *
 * NOT used by `apps/api/src/modules/auth/rate-limit.ts`'s Postgres-backed
 * auth/login limiters, even though they share this same conceptual
 * contract (check, refundable release keyed by a window token) - this
 * `RateLimiter` interface is deliberately synchronous (built for the
 * socket-presence hot path this file backs), while a Postgres-backed
 * implementation is necessarily async. See that file's own docblock and
 * BACKLOG.md before attempting to unify them.
 */
export function createRateLimiter(
  { limit, windowMs }: RateLimitOptions,
  maxTrackedKeys = 10_000,
  sweepBatchSize = 256,
): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  // Resumable cursor over `buckets`, kept across calls so a sweep never
  // examines more than `sweepBatchSize` entries in one go - a full-map scan
  // run inline on every isLimited() call once the map is at its cap would
  // otherwise repeat on a hot per-request path (e.g. once-a-second socket
  // presence packets) for as long as the map stays saturated. Map iterators
  // are live per spec: entries deleted/inserted elsewhere between batches
  // don't invalidate a paused iterator.
  let sweepCursor: IterableIterator<[string, { count: number; resetAt: number }]> | null = null;

  function sweepExpired(now: number): void {
    sweepCursor ??= buckets.entries();
    let examined = 0;
    let next = sweepCursor.next();
    while (!next.done && examined < sweepBatchSize) {
      const [key, bucket] = next.value;
      if (now >= bucket.resetAt) buckets.delete(key);
      examined += 1;
      next = sweepCursor.next();
    }
    if (next.done) sweepCursor = null; // pass complete - start a fresh one next time
  }

  function isLimited(key: string): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      if (buckets.size >= maxTrackedKeys) sweepExpired(now);
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    if (bucket.count >= limit) return true;
    bucket.count += 1;
    return false;
  }

  function currentWindowToken(key: string): number | null {
    return buckets.get(key)?.resetAt ?? null;
  }

  function release(key: string, windowToken: number | null): void {
    if (windowToken === null) return;
    const bucket = buckets.get(key);
    if (bucket?.resetAt !== windowToken) return;
    bucket.count = Math.max(0, bucket.count - 1);
  }

  function reset(): void {
    buckets.clear();
    sweepCursor = null;
  }

  return { isLimited, currentWindowToken, release, reset };
}
