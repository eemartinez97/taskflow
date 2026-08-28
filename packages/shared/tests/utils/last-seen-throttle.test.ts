import { afterEach, describe, expect, it, vi } from "vitest";
import { createLastSeenThrottle } from "../../src/utils/last-seen-throttle";

describe("createLastSeenThrottle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true the first time it's called for a userId", () => {
    const throttle = createLastSeenThrottle(60_000);

    expect(throttle.shouldWrite("user-1")).toBe(true);
  });

  it("returns false on a second call within the TTL", () => {
    const throttle = createLastSeenThrottle(60_000);

    throttle.shouldWrite("user-1");
    expect(throttle.shouldWrite("user-1")).toBe(false);
  });

  it("returns true again once the TTL has elapsed", () => {
    vi.useFakeTimers();
    const throttle = createLastSeenThrottle(60_000);

    expect(throttle.shouldWrite("user-1")).toBe(true);
    vi.advanceTimersByTime(60_001);
    expect(throttle.shouldWrite("user-1")).toBe(true);
  });

  it("tracks separate userIds independently", () => {
    const throttle = createLastSeenThrottle(60_000);

    expect(throttle.shouldWrite("user-1")).toBe(true);
    expect(throttle.shouldWrite("user-2")).toBe(true);
    expect(throttle.shouldWrite("user-1")).toBe(false);
    expect(throttle.shouldWrite("user-2")).toBe(false);
  });

  it("reset() clears all watermarks", () => {
    const throttle = createLastSeenThrottle(60_000);

    throttle.shouldWrite("user-1");
    throttle.reset();

    expect(throttle.shouldWrite("user-1")).toBe(true);
  });
});
