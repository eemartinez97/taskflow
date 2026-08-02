import { vi } from "vitest";
import type { Logger } from "../../src/config/logger";

/**
 * Silent logger mock reused across setup.ts and makeCtx().
 * Single source of truth - change once, applies everywhere.
 */
export const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(),
  level: "silent",
} satisfies Partial<Logger> as unknown as Logger;

/** `vi.resetAllMocks()` wipes `.mockReturnThis()`, so re-arm it each test. */
export function armLoggerMock(): void {
  vi.mocked(mockLogger.child).mockReturnValue(mockLogger as unknown as ReturnType<Logger["child"]>);
}
