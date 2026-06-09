import { afterEach, describe, vi, it, expect } from "vitest";

// Control isProduction return value per-test
vi.mock("../../../src/config/env.ts", async () => {
  const { envMockFactory } = await import("../../mocks/env.js");
  return envMockFactory();
});

import { isProduction } from "../../../src/config/env.js";

afterEach(() => {
  vi.resetModules();
  vi.mocked(isProduction).mockReturnValue(false);
});

describe("logger factory", () => {
  it("returns a pino logger instance in development (with pino-pretty transport)", async () => {
    vi.mocked(isProduction).mockReturnValue(false);

    const { logger } = await import("../../../src/config/logger.js");

    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });

  it("returns a pino logger instance in production (raw JSON - no transport)", async () => {
    vi.mocked(isProduction).mockReturnValue(true);

    const { logger } = await import("../../../src/config/logger.js");

    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("logger.level is set from API_LOG_LEVEL env var", async () => {
    const { logger } = await import("../../../src/config/logger.js");
    // env mock sets API_LOG_LEVEL: "silent"
    expect(logger.level).toBe("silent");
  });
});
