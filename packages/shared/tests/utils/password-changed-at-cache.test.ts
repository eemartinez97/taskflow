import { describe, expect, it, vi } from "vitest";
import { createPasswordChangedAtCache } from "../../src/utils/password-changed-at-cache";

describe("createPasswordChangedAtCache", () => {
  it("calls fetch on a cache miss and returns its result", async () => {
    const cache = createPasswordChangedAtCache();
    const fetch = vi.fn().mockResolvedValue(123);

    await expect(cache.get("user-1", fetch)).resolves.toBe(123);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it("caches null results too", async () => {
    const cache = createPasswordChangedAtCache();
    const fetch = vi.fn().mockResolvedValue(null);

    await cache.get("user-1", fetch);
    await expect(cache.get("user-1", fetch)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not re-fetch within the TTL", async () => {
    const cache = createPasswordChangedAtCache(60_000);
    const fetch = vi.fn().mockResolvedValue(1);

    await cache.get("user-1", fetch);
    await cache.get("user-1", fetch);

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("re-fetches once the TTL has elapsed", async () => {
    vi.useFakeTimers();
    const cache = createPasswordChangedAtCache(60_000);
    const fetch = vi.fn().mockResolvedValue(1);

    await cache.get("user-1", fetch);
    vi.advanceTimersByTime(60_001);
    await cache.get("user-1", fetch);

    expect(fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("tracks separate userIds independently", async () => {
    const cache = createPasswordChangedAtCache();
    const fetch = vi.fn().mockImplementation((userId: string) => Promise.resolve(userId.length));

    await expect(cache.get("a", fetch)).resolves.toBe(1);
    await expect(cache.get("bb", fetch)).resolves.toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reset() clears all cached entries", async () => {
    const cache = createPasswordChangedAtCache();
    const fetch = vi.fn().mockResolvedValue(1);

    await cache.get("user-1", fetch);
    cache.reset();
    await cache.get("user-1", fetch);

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
