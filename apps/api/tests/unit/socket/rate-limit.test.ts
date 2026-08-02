import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimitState, shouldDropPresencePacket } from "../../../src/socket/rate-limit";

const ROOM = "project:abc";
const LIMIT = 30;

describe("shouldDropPresencePacket", () => {
  beforeEach(() => {
    resetRateLimitState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitState();
  });

  it("lets the first packet through and opens the window", () => {
    expect(shouldDropPresencePacket(ROOM)).toBe(false);
  });

  it("allows exactly 30 packets per second, then drops", () => {
    const results = Array.from({ length: LIMIT + 2 }, () => shouldDropPresencePacket(ROOM));

    expect(results.slice(0, LIMIT)).toEqual(Array(LIMIT).fill(false));
    expect(results.slice(LIMIT)).toEqual([true, true]);
  });

  it("resets when the window rolls over", () => {
    for (let i = 0; i < LIMIT + 1; i++) shouldDropPresencePacket(ROOM);
    expect(shouldDropPresencePacket(ROOM)).toBe(true);

    vi.advanceTimersByTime(1000);

    expect(shouldDropPresencePacket(ROOM)).toBe(false);
  });

  it("keeps one independent bucket per room", () => {
    for (let i = 0; i < LIMIT + 1; i++) shouldDropPresencePacket(ROOM);

    expect(shouldDropPresencePacket(ROOM)).toBe(true);
    expect(shouldDropPresencePacket("project:other")).toBe(false);
  });

  it("evicts expired buckets once the tracking cap is reached", () => {
    shouldDropPresencePacket("project:stale", 2);
    vi.advanceTimersByTime(1500); // "project:stale" window has closed

    shouldDropPresencePacket("project:a", 2);
    shouldDropPresencePacket("project:b", 2); // size >= 2 -> sweep runs

    // Proof the sweep ran: the stale room starts a brand-new window
    expect(shouldDropPresencePacket("project:stale", 2)).toBe(false);
  });
});

describe("resetRateLimitState", () => {
  it("clears every bucket", () => {
    vi.useFakeTimers();
    for (let i = 0; i < LIMIT + 1; i++) shouldDropPresencePacket(ROOM);
    expect(shouldDropPresencePacket(ROOM)).toBe(true);

    resetRateLimitState();

    expect(shouldDropPresencePacket(ROOM)).toBe(false);
    vi.useRealTimers();
  });
});
