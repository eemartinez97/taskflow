/**
 * Per project presence broadcast rate limiter.
 *
 * Algorithm: sliding fixed-window counter
 * - First packet in a window initialises the bucket.
 * - Each subsequent packet increments the counter.
 * - When count exceeds PRESENCE_RATE_LIMIT the packet is dropped.
 * - After PRESENCE_WINDOW_MS the bucket resets automatically on next call.
 */
const PRESENCE_RATE_LIMIT = 30; // max presence packets per project room per second
const PRESENCE_WINDOW_MS = 1_000;

const presenceRateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Returns `true` if the presence packet for `room` should be dropped.
 * Mutates `presenceRateLimitMap` as a side effect (bucket counter update)
 */
export function shouldDropPresencePacket(room: string): boolean {
  const now = Date.now();
  const entry = presenceRateLimitMap.get(room);

  if (!entry || now >= entry.resetAt) {
    presenceRateLimitMap.set(room, { count: 1, resetAt: now + PRESENCE_WINDOW_MS });
    return false;
  }

  if (entry.count >= PRESENCE_RATE_LIMIT) return true;

  entry.count += 1;
  return false;
}

/** Exposed for testing - resets all buckets to a clean state. */
export function resetRateLimitState(): void {
  presenceRateLimitMap.clear();
}
