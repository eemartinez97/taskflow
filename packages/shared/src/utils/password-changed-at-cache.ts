export interface PasswordChangedAtCache<T> {
  /**
   * Returns the cached value for `userId` if it's still within the TTL,
   * otherwise calls `fetch`, caches the result, and returns it.
   */
  get: (userId: string, fetch: (userId: string) => Promise<T>) => Promise<T>;
  /** Clears all cached entries - exposed for tests. */
  reset: () => void;
}

/**
 * Generic short-TTL cache for a per-user revocation lookup, keyed by userId.
 * Generic over `T` (not hardcoded to `number | null`) so each call site's
 * `fetch` can distinguish "user exists, no passwordChangedAt on record" from
 * "user doesn't exist at all" - e.g. `{ passwordChangedAtMs: number | null }
 * | null`, outer `null` meaning the latter. A cache keyed on a bare
 * `number | null` can't make that distinction, which is exactly what let a
 * deleted user's still-live session cookie keep authenticating indefinitely
 * (nothing about "no password change on record" and "no such user" reads as
 * different once both collapse to the same `null`).
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
 * mechanism in packages/shared, thin per-app wrappers own the DB call, the
 * TTL value, and the exact shape of `T`.
 *
 * CAVEAT: single-process / in-memory, same as createRateLimiter. Each
 * process (and each app) has its own independent cache and TTL window -
 * multiple replicas don't widen the revocation window beyond one process's
 * own TTL.
 */
export function createPasswordChangedAtCache<T>(ttlMs = 60_000): PasswordChangedAtCache<T> {
  const cache = new Map<string, { value: T; cachedAt: number }>();

  async function get(userId: string, fetch: (userId: string) => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = cache.get(userId);
    if (cached && now - cached.cachedAt < ttlMs) {
      return cached.value;
    }

    const value = await fetch(userId);
    cache.set(userId, { value, cachedAt: now });
    return value;
  }

  function reset(): void {
    cache.clear();
  }

  return { get, reset };
}
