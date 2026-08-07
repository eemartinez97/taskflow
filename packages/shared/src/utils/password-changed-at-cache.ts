export interface PasswordChangedAtCache {
  /**
   * Returns the cached value for `userId` if it's still within the TTL,
   * otherwise calls `fetch`, caches the result, and returns it.
   */
  get: (
    userId: string,
    fetch: (userId: string) => Promise<number | null>,
  ) => Promise<number | null>;
  /** Clears all cached entries - exposed for tests. */
  reset: () => void;
}

/**
 * Generic short-TTL cache for a user's `passwordChangedAt` (epoch ms, or
 * null if never reset), keyed by userId.
 *
 * WHY THIS EXISTS: both apps/api's getSessionUser and apps/web's
 * isSessionRevoked independently reject a session issued before its owner's
 * most recent password reset - a stateless JWT/JWE session cookie has no
 * other way to be revoked. Each call site otherwise runs one DB read per
 * request on the hottest path in the app, so both cache the result for a
 * bounded TTL. This factory owns the shared caching mechanics (bucket map,
 * TTL check, eviction-free growth bounded by actual user count); each app
 * supplies its own `fetch` callback because each queries its own Prisma
 * client instance. Same pattern as createRateLimiter - a policy-free
 * mechanism in packages/shared, thin per-app wrappers own the DB call and
 * the TTL value.
 *
 * CAVEAT: single-process / in-memory, same as createRateLimiter. Each
 * process (and each app) has its own independent cache and TTL window -
 * multiple replicas don't widen the revocation window beyond one process's
 * own TTL.
 */
export function createPasswordChangedAtCache(ttlMs = 60_000): PasswordChangedAtCache {
  const cache = new Map<string, { passwordChangedAtMs: number | null; cachedAt: number }>();

  async function get(
    userId: string,
    fetch: (userId: string) => Promise<number | null>,
  ): Promise<number | null> {
    const now = Date.now();
    const cached = cache.get(userId);
    if (cached && now - cached.cachedAt < ttlMs) {
      return cached.passwordChangedAtMs;
    }

    const passwordChangedAtMs = await fetch(userId);
    cache.set(userId, { passwordChangedAtMs, cachedAt: now });
    return passwordChangedAtMs;
  }

  function reset(): void {
    cache.clear();
  }

  return { get, reset };
}
