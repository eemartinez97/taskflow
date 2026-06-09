import { describe, expect, it } from "vitest";
import { envSchema, isDevelopment, isProduction, isTest } from "../../../src/config/env.js";

/** Minimal valid env payload reused across all cases */
const validBase = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  NEXTAUTH_SECRET: "a-secret-value-long-enough",
};

describe("env schema validation", () => {
  it("applies default NODE_ENV=development when not set", () => {
    expect(envSchema.parse(validBase).NODE_ENV).toBe("development");
  });

  it("applies default API_PORT=8000 when not set", () => {
    expect(envSchema.parse(validBase).API_PORT).toBe(8000);
  });

  it("coerces API_PORT string to number", () => {
    const result = envSchema.parse({ ...validBase, API_PORT: "9000" });
    expect(result.API_PORT).toBe(9000);
    expect(typeof result.API_PORT).toBe("number");
  });

  it("applies default WEB_ORIGIN when not set", () => {
    expect(envSchema.parse(validBase).WEB_ORIGIN).toBe("http://localhost:3000");
  });

  it("accepts a custom WEB_ORIGIN", () => {
    const WEB_ORIGIN = "https://app.taskflow.dev";
    const result = envSchema.parse({ ...validBase, WEB_ORIGIN });
    expect(result.WEB_ORIGIN).toBe(WEB_ORIGIN);
  });

  it("accepts all valid LOG_LEVEL values", () => {
    const levels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
    for (const level of levels) {
      expect(envSchema.parse({ ...validBase, API_LOG_LEVEL: level }).API_LOG_LEVEL).toBe(level);
    }
  });

  it("rejects invalid LOG_LEVEL", () => {
    expect(() => envSchema.parse({ ...validBase, API_LOG_LEVEL: "verbose" })).toThrow();
  });

  it("rejects empty DATABASE_URL", () => {
    expect(() => envSchema.parse({ ...validBase, DATABASE_URL: "" })).toThrow();
  });

  it("rejects NEXTAUTH_SECRET shorter than 16 characters", () => {
    expect(() => envSchema.parse({ ...validBase, NEXTAUTH_SECRET: "tooshort" })).toThrow();
  });

  it("rejects API_PORT outside valid range", () => {
    expect(() => envSchema.parse({ ...validBase, API_PORT: "99999" })).toThrow();
    expect(() => envSchema.parse({ ...validBase, API_PORT: "0" })).toThrow();
  });

  it("rejects invalid NODE_ENV value", () => {
    expect(() => envSchema.parse({ ...validBase, NODE_ENV: "staging" })).toThrow();
  });
});

/**
 * Helper functions — tests/setup.ts sets NODE_ENV=test, so the parsed
 * env singleton has NODE_ENV: "test" when this module is imported.
 */
describe("env helper functions", () => {
  it("isTest() returns true when NODE_ENV is 'test'", () => {
    expect(isTest()).toBe(true);
  });

  it("isProduction() returns false when NODE_ENV is 'test'", () => {
    expect(isProduction()).toBe(false);
  });

  it("isDevelopment() returns false when NODE_ENV is 'test'", () => {
    expect(isDevelopment()).toBe(false);
  });
});
