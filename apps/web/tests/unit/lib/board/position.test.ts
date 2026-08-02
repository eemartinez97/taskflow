import { describe, expect, it } from "vitest";
import { calculateNewPosition } from "@/lib/board/position";
import { POSITION_STEP } from "@taskflow/shared";

describe("calculateNewPosition", () => {
  it("returns the midpoint when both neighbors exist", () => {
    expect(calculateNewPosition(1000, 2000)).toBe(1500);
  });

  it("adds POSITION_STEP to prev when there's no next", () => {
    expect(calculateNewPosition(1000, null)).toBe(1000 + POSITION_STEP);
  });

  it("returns half of next when there's no prev", () => {
    expect(calculateNewPosition(null, 1000)).toBe(500);
  });

  it("returns POSITION_STEP when both are null (empty column)", () => {
    expect(calculateNewPosition(null, null)).toBe(POSITION_STEP);
  });
});
