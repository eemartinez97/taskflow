/**
 * Mock for the `pino` native logger module.
 *
 * Pino has a binary step in some environments.
 * In unit tests we replace it with a silent vi.fn() logger
 * so tests remain fast and don't pollute stdout.
 *
 * Active per test file:
 *   vi.mock("pino", () => import("@/tests/mocks/pino"));
 */
import type { Logger } from "pino";
import { vi } from "vitest";

export const mockPinoLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
  level: "silent",
} as unknown as Logger;

const pino = vi.fn(() => mockPinoLogger);
export default pino;
