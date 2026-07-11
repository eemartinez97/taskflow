import { describe, expect, it, vi } from "vitest";

vi.mock("pino", () => import("@/tests/mocks/pino"));

import pino, { mockPinoLogger } from "@/tests/mocks/pino";
import { getLogLevel, logger } from "@/lib/logger";

describe("getLogLevel", () => {
  it("returns 'warn' in production", () => {
    expect(getLogLevel("production")).toBe("warn");
  });

  it.each(["development", "test", "staging", "", "PRODUCTION"])(
    "returns 'debug' for non-production env '%s'",
    (env) => {
      expect(getLogLevel(env)).toBe("debug");
    },
  );
});

describe("logger singleton", () => {
  it("is the instance returned by the pino factory", () => {
    expect(logger).toBe(mockPinoLogger);
  });

  it("exposes standard logging methods (info, warn, error, debug)", () => {
    for (const method of ["info", "warn", "error", "debug"] as const) {
      expect(typeof logger[method]).toBe("function");
    }
  });

  it("pino factory is called with 'debug' level in the test environment", async () => {
    vi.resetModules();
    await import("@/lib/logger");
    expect(vi.mocked(pino)).toHaveBeenCalledWith({ level: "debug" });
  });
});
