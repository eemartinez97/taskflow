import { createRateLimiter } from "@taskflow/shared";

/**
 * Per project presence broadcast rate limiter.
 *
 * Thin policy wrapper around @taskflow/shared's generic sliding-window
 * limiter - this module only encodes WHICH limit applies to presence
 * packets. Same pattern as apps/web/lib/auth/rate-limit.ts.
 */
const PRESENCE_RATE_LIMIT = 30; // max presence packets per project room per second
const PRESENCE_WINDOW_MS = 1_000;

const MAX_TRACKED_ROOMS = 10_000;

let presenceLimiter = createRateLimiter(
  { limit: PRESENCE_RATE_LIMIT, windowMs: PRESENCE_WINDOW_MS },
  MAX_TRACKED_ROOMS,
);
/** Returns `true` if the presence packet for `room` should be dropped. */
export function shouldDropPresencePacket(room: string): boolean {
  return presenceLimiter.isLimited(room);
}

/** Exposed for testing - resets all buckets to a clean state. */
export function resetRateLimitState(): void {
  presenceLimiter.reset();
}

/**
 * Test-only: rebuilds the limiter with a smaller tracking cap so
 * eviction-sweep tests can trigger the sweep without creating 10,000 rooms.
 * Call `resetRateLimitState` (or re-invoke this) to restore the default cap
 * of `MAX_TRACKED_ROOMS` afterward.
 */
export function __setMaxTrackedRoomsForTest(maxTrackedRooms: number = MAX_TRACKED_ROOMS): void {
  presenceLimiter = createRateLimiter(
    { limit: PRESENCE_RATE_LIMIT, windowMs: PRESENCE_WINDOW_MS },
    maxTrackedRooms,
  );
}
