export interface LastSeenThrottle {
  /**
   * Returns true the first time it's called for `userId`, or once `ttlMs`
   * has elapsed since the last time it returned true for that id - and
   * records `now` as the new watermark whenever it does. Returns false
   * otherwise (still inside the throttle window).
   */
  shouldWrite: (userId: string) => boolean;
  /** Clears all watermarks - exposed for tests. */
  reset: () => void;
}

/**
 * Generic per-key throttle, keyed by userId. Backs the activeUsersTotal
 * gauge's lastSeenAt write: apps/api's getSessionUser and apps/web's
 * getSession each hit this on every authenticated request/page view, so both
 * throttle the actual DB write to once per `ttlMs` per user instead of
 * writing on every single call. Each app owns its own instance (own process,
 * own Prisma client) - this factory owns only the shared watermark mechanics,
 * same "policy-free mechanism in packages/shared, thin per-app wrapper owns
 * the DB call" split as createPasswordChangedAtCache.
 *
 * CAVEAT: single-process / in-memory, same as createPasswordChangedAtCache -
 * grows one entry per distinct user who has ever authenticated against this
 * process, never evicted. Accepted for the same reason
 * createPasswordChangedAtCache is: bounded by real user count, not unbounded
 * in any practical sense, and a portfolio-scale process's lifetime doesn't
 * make that growth material.
 */
export function createLastSeenThrottle(ttlMs: number): LastSeenThrottle {
  const lastWrittenAt = new Map<string, number>();

  function shouldWrite(userId: string): boolean {
    const now = Date.now();
    const last = lastWrittenAt.get(userId);
    if (last !== undefined && now - last < ttlMs) return false;

    lastWrittenAt.set(userId, now);
    return true;
  }

  function reset(): void {
    lastWrittenAt.clear();
  }

  return { shouldWrite, reset };
}
