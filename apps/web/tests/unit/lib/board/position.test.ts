import { describe, expect, it } from "vitest";

import { POSITION_STEP } from "@taskflow/shared";

import { calculateNewPosition, getSurroundingPositions } from "@/lib/board/position";

describe("calculateNewPosition", () => {
  it("returns POSITION_STEP when both prev and next are null (empty column)", () => {
    expect(calculateNewPosition(null, null)).toBe(POSITION_STEP);
  });

  it("places the item at half of next when prev is null (prepend)", () => {
    expect(calculateNewPosition(null, 2000)).toBe(1000);
  });

  it("places the item POSITION_STEP after prev when next is null (append)", () => {
    expect(calculateNewPosition(1000, null)).toBe(1000 + POSITION_STEP);
  });

  it("places item at the midpoint between prev and next", () => {
    expect(calculateNewPosition(1000, 3000)).toBe(2000);
  });

  it("handles adjacent integers correctly (midpoint is a float)", () => {
    expect(calculateNewPosition(1000, 1001)).toBe(1000.5);
  });

  it("handles large positions without overflow", () => {
    const result = calculateNewPosition(1_000_000, 2_000_000);
    expect(result).toBe(1_500_000);
  });

  it("midpoint is always greater than prev", () => {
    const result = calculateNewPosition(1000, 2000);
    expect(result).toBeGreaterThan(1000);
  });

  it("midpoint is always less than next", () => {
    const result = calculateNewPosition(1000, 2000);
    expect(result).toBeLessThan(2000);
  });
});

describe("getSurroundingPositions", () => {
  const positions = [1000, 2000, 3000, 4000];

  it("returns null/next for index 0 (first position)", () => {
    expect(getSurroundingPositions(positions, 0)).toEqual({ prev: null, next: 1000 });
  });

  it("returns prev/null for the last index (append)", () => {
    expect(getSurroundingPositions(positions, 4)).toEqual({ prev: 4000, next: null });
  });

  it("returns surrounding positions for a middle index", () => {
    expect(getSurroundingPositions(positions, 2)).toEqual({ prev: 2000, next: 3000 });
  });

  it("returns null/null for an empty array at index 0", () => {
    expect(getSurroundingPositions([], 0)).toEqual({ prev: null, next: null });
  });

  it("returns exact values at each boundary", () => {
    const { prev, next } = getSurroundingPositions([500, 1500], 1);
    expect(prev).toBe(500);
    expect(next).toBe(1500);
  });
});
