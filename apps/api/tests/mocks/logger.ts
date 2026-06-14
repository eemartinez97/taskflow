import { vi } from "vitest";
import type { Logger } from "../../src/config/logger.js";

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
  child: vi.fn().mockReturnThis(),
  level: "silent",
} as unknown as Logger;
