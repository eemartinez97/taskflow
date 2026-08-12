/**
 * Runs `fn` and, if it resolves faster than `minMs`, waits out the
 * remainder before returning - so callers whose branches do different
 * amounts of work (e.g. "account exists, write to DB + email" vs "account
 * doesn't exist, do nothing") stop leaking which branch ran via response
 * latency, even when the response BODY is already identical.
 *
 * This narrows the observable timing gap to whatever variance survives
 * above `minMs` (e.g. a slow outbound email-provider call that itself
 * exceeds the floor) rather than eliminating timing side-channels
 * entirely - pick `minMs` close to the slower branches' realistic p95.
 */
export async function withMinimumLatency<T>(fn: () => Promise<T>, minMs: number): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    // Runs on both the resolve AND reject paths - a `fn` that throws (e.g. a
    // transient DB error) must still respect the floor, or the timing gap
    // this helper exists to close reopens for that failure path.
    const elapsed = Date.now() - start;
    if (elapsed < minMs) {
      await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
    }
  }
}
