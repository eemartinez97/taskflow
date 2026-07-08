import { POSITION_STEP } from "@taskflow/shared";

/**
 * Calculates the new position for a task being moved.
 *
 * Strategy: midpoint between the previous and next item's positions.
 * Falls back to `prev + POSITION_STEP` or `POSITION_STEP` for edge cases.
 *
 * This keeps positions as fractional floats and avoids O(n) renumbering
 * on every move.
 */
export function calculateNewPosition(
  prevPosition: number | null,
  nextPosition: number | null,
): number {
  if (prevPosition !== null && nextPosition !== null) return (prevPosition + nextPosition) / 2;
  if (prevPosition !== null) return prevPosition + POSITION_STEP;
  if (nextPosition !== null) return nextPosition / 2;

  return POSITION_STEP;
}

/**
 * Returns the prev/next positions around `targetIndex` in an ordered array.
 * Used by useBoardDnD to compute the dropped task's new position.
 */
export function getSurroundingPositions(
  positions: number[],
  targetIndex: number,
): { prev: number | null; next: number | null } {
  const prev = positions[targetIndex - 1] ?? null;
  const next = positions[targetIndex] ?? null;
  return { prev, next };
}
