import { vi } from "vitest";

import { armDbMocks } from "../mocks/database";
import { armSocketMocks } from "../mocks/socket";
import { armLoggerMock } from "../mocks/logger";
import { armHttpMock } from "../mocks/http";

/**
 * Why resetAllMocks and not clearAllMocks:
 * `mockClear()` does NOT drain queued `...Once()` implementations. A test that
 * fails early leaves a stale `mockResolvedValueOnce` behind and poisons the
 * next one - the classic "passes alone, fails in suite" bug.
 *
 * `resetAllMocks()` drains them but also strips `.mockReturnValue()`, so every
 * mock module exports an `arm*()` that re-establishes its defaults.
 */

export function resetAllTestMocks(): void {
  vi.resetAllMocks();
  armDbMocks();
  armSocketMocks();
  armLoggerMock();
  armHttpMock();
}
