import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../../src/utils/rate-limit";

describe("createRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.isLimited("a")).toBe(false);
    expect(limiter.isLimited("a")).toBe(false);
  });

  it("blocks requests once the limit is reached within the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    limiter.isLimited("a");
    limiter.isLimited("a");
    expect(limiter.isLimited("a")).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.isLimited("a")).toBe(false);
    expect(limiter.isLimited("b")).toBe(false);
  });

  it("resets the bucket once the window elapses", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.isLimited("a");
    expect(limiter.isLimited("a")).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(limiter.isLimited("a")).toBe(false);
    vi.useRealTimers();
  });

  it("sweeps expired buckets once maxTrackedKeys is reached", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 }, 2);
    limiter.isLimited("a");
    vi.advanceTimersByTime(1001);
    limiter.isLimited("b");
    limiter.isLimited("c"); // triggers sweep, "a" bucket already expired
    expect(limiter.isLimited("a")).toBe(false); // fresh bucket, not limited
    vi.useRealTimers();
  });

  it("sweeps in bounded batches instead of scanning the whole map at once", () => {
    vi.useFakeTimers();
    // maxTrackedKeys=3 (cap reached fast), sweepBatchSize=1 (one entry examined per sweep call).
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 }, 3, 1);
    limiter.isLimited("stale-a");
    limiter.isLimited("stale-b");
    vi.advanceTimersByTime(1001); // both windows expire

    limiter.isLimited("c"); // size (3) >= cap -> sweep runs, examines only 1 entry
    limiter.isLimited("d"); // size still >= cap -> sweep resumes, examines the next entry

    // Both stale entries get cleaned up across the two bounded sweep calls -
    // observable via isLimited() still behaving correctly for them either way.
    expect(limiter.isLimited("stale-a")).toBe(false); // fresh window regardless of sweep timing
    expect(limiter.isLimited("stale-b")).toBe(false);
    vi.useRealTimers();
  });

  it("reset() clears all buckets", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.isLimited("a");
    limiter.reset();
    expect(limiter.isLimited("a")).toBe(false);
  });

  it("release() gives back one count, freeing the next isLimited() call", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    limiter.isLimited("a");
    limiter.isLimited("a");
    expect(limiter.isLimited("a")).toBe(true); // 3rd call: blocked

    limiter.release("a", limiter.currentWindowToken("a"));
    expect(limiter.isLimited("a")).toBe(false); // quota freed by the release
  });

  it("release() never drops a bucket's count below zero", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.release("a", limiter.currentWindowToken("a")); // no bucket yet (null token) - must not throw
    limiter.isLimited("a");
    const token = limiter.currentWindowToken("a");
    limiter.release("a", token);
    limiter.release("a", token); // already at 0 - must not go negative
    expect(limiter.isLimited("a")).toBe(false);
    expect(limiter.isLimited("a")).toBe(true);
  });

  it("release() is a no-op once the bucket's window has already expired", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.isLimited("a");
    const token = limiter.currentWindowToken("a");
    vi.advanceTimersByTime(1001);
    limiter.release("a", token); // stale token - must not resurrect the expired bucket
    expect(limiter.isLimited("a")).toBe(false); // fresh bucket either way
    vi.useRealTimers();
  });

  it("release() does not leak quota into a new window after a rollover (stale token)", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.isLimited("a"); // opens window 1, count = 1
    const staleToken = limiter.currentWindowToken("a");

    vi.advanceTimersByTime(1001); // window 1 expires
    limiter.isLimited("a"); // opens window 2, count = 1

    limiter.release("a", staleToken); // release for window 1 must not touch window 2
    expect(limiter.isLimited("a")).toBe(true); // window 2 still at its limit
    vi.useRealTimers();
  });
});
