/**
 * Mock for `@dnd-kit/utilities`.
 *
 * Eliminates the repeated inline:
 *   vi.mock("@dnd-kit/utilities", () => ({ CSS: { Transform: { toString: vi.fn(() => "") } } }))
 *
 * Activate per test file:
 *   vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities.js"));
 */

import { vi } from "vitest";

export const CSS = {
  Transform: {
    toString: vi.fn((): string => ""),
  },
};
