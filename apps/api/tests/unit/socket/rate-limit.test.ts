import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitState, shouldDropPresencePacket } from "../../../src/socket/rate-limit.js";

const ROOM = "project:test-room";
const OTHER_ROOM = "project:other-room";

/** Sends `count` presence packet to `room` and discards the results. */
function sendPackets(room: string, count: number): void {
  for (let i = 0; i < count; i++) shouldDropPresencePacket(room);
}

beforeEach(() => {
  vi.useFakeTimers();
  resetRateLimitState();
});

afterEach(() => {
  vi.useRealTimers();
  resetRateLimitState();
});

describe("shouldDropPresencePacket", () => {
  it("returns false for the first packet (initializes bucket)", () => {
    expect(shouldDropPresencePacket(ROOM)).toBe(false);
  });

  it("allows up to 30 packets per second (the limit)", () => {
    sendPackets(ROOM, 29);
    expect(shouldDropPresencePacket(ROOM)).toBe(false);
  });

  it("drops the 31st packet in the same window", () => {
    sendPackets(ROOM, 30);
    expect(shouldDropPresencePacket(ROOM)).toBe(true);
  });

  it("continues dropping packets after the first drop in the same windows", () => {
    sendPackets(ROOM, 31);
    expect(shouldDropPresencePacket(ROOM)).toBe(true);
    expect(shouldDropPresencePacket(ROOM)).toBe(true);
  });

  it("resets the bucket after 1000ms and allows packets again", () => {
    sendPackets(ROOM, 31);
    expect(shouldDropPresencePacket(ROOM)).toBe(true);

    vi.advanceTimersByTime(1_000);

    // New window - bucket reset -> first packet allowed
    expect(shouldDropPresencePacket(ROOM)).toBe(false);
  });

  it("tracks each room independently", () => {
    // Fill ROOM to the limit
    sendPackets(ROOM, 31);

    // OTHER_ROOM is unaffected - first packet allowed
    expect(shouldDropPresencePacket(OTHER_ROOM)).toBe(false);
  });

  it("resets bucket exactly at window boundary (boundary condition)", () => {
    shouldDropPresencePacket(ROOM); // initialize with resetAll = now + 1000
    vi.advanceTimersByTime(999);
    shouldDropPresencePacket(ROOM); // still inside window
    vi.advanceTimersByTime(1); // now >= resetAll -> new window
    expect(shouldDropPresencePacket(ROOM)).toBe(false);
  });

  it("resetRateLimitState clears all buckets", () => {
    sendPackets(ROOM, 31);

    expect(shouldDropPresencePacket(ROOM)).toBe(true);

    resetRateLimitState();

    expect(shouldDropPresencePacket(ROOM)).toBe(false);
  });
});
