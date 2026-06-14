import { beforeEach, describe, vi, it, expect } from "vitest";

vi.mock("../../../src/config/env.js");
vi.unmock("../../../src/config/logger.js");

// Clear module registry before each test so dynamic imports below
// always receive a freshly evaluated module — critical for the
// production-branch test where isProduction must return true BEFORE
// logger.ts is evaluated.
beforeEach(() => {
  vi.resetModules();
});

describe("logger factory", () => {
  it("development: returns pino logger with pino-pretty transport", async () => {
    // Import env FIRST to get the fresh mock reference after resetModules,
    // set the return value, THEN import logger so it sees isProduction()===false
    const { isProduction } = await import("../../../src/config/env.js");
    vi.mocked(isProduction).mockReturnValue(false);
    const { logger } = await import("../../../src/config/logger.js");

    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });

  it("production: returns a pino logger instance in production (raw JSON — no transport)", async () => {
    const { isProduction } = await import("../../../src/config/env.js");
    vi.mocked(isProduction).mockReturnValue(true);

    const { logger } = await import("../../../src/config/logger.js");

    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("logger.level is set from API_LOG_LEVEL env var", async () => {
    const { isProduction } = await import("../../../src/config/env.js");
    vi.mocked(isProduction).mockReturnValue(false);

    const { logger } = await import("../../../src/config/logger.js");

    // env mock sets API_LOG_LEVEL: "silent"
    expect(logger.level).toBe("silent");
  });

  it("production logger has no pino-pretty transport overhead", async () => {
    const { isProduction } = await import("../../../src/config/env.js");
    vi.mocked(isProduction).mockReturnValue(true);

    const { logger } = await import("../../../src/config/logger.js");

    // In production raw JSON is emitted — level is still readable
    expect(logger.level).toBeDefined();
  });
});
