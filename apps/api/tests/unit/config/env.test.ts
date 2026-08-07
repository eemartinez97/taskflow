import { afterEach, describe, expect, it, vi } from "vitest";

import { envSchema, isDevelopment, isProduction, isTest, parseEnv } from "../../../src/config/env";
import { env as mockEnv } from "../../../src/config/__mocks__/env";

const REQUIRED = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  NEXTAUTH_SECRET: "0123456789abcdef",
};

describe("envSchema", () => {
  it("applies every default", () => {
    const parsed = envSchema.parse(REQUIRED);

    expect(parsed).toMatchObject({
      NODE_ENV: "development",
      API_PORT: 8000,
      API_LOG_LEVEL: "info",
      WEB_ORIGIN: "http://localhost:3000",
      TRUSTED_PROXY_HOPS: 0,
    });
  });

  it("coerces API_PORT from string", () => {
    expect(envSchema.parse({ ...REQUIRED, API_PORT: "9999" }).API_PORT).toBe(9999);
  });

  it("coerces TRUSTED_PROXY_HOPS from string", () => {
    expect(envSchema.parse({ ...REQUIRED, TRUSTED_PROXY_HOPS: "2" }).TRUSTED_PROXY_HOPS).toBe(2);
  });

  it("allows TRUSTED_PROXY_HOPS: 0 to disable proxy trust entirely", () => {
    expect(envSchema.parse({ ...REQUIRED, TRUSTED_PROXY_HOPS: "0" }).TRUSTED_PROXY_HOPS).toBe(0);
  });

  it("defaults PASSWORD_CHANGED_AT_CACHE_TTL_MS to 60s when omitted", () => {
    expect(envSchema.parse(REQUIRED).PASSWORD_CHANGED_AT_CACHE_TTL_MS).toBe(60_000);
  });

  it("coerces PASSWORD_CHANGED_AT_CACHE_TTL_MS from string", () => {
    expect(
      envSchema.parse({ ...REQUIRED, PASSWORD_CHANGED_AT_CACHE_TTL_MS: "2000" })
        .PASSWORD_CHANGED_AT_CACHE_TTL_MS,
    ).toBe(2000);
  });

  it("treats METRICS_TOKEN: '' the same as unset (docker-compose.yml's ${VAR:-} always sets the key)", () => {
    expect(envSchema.parse({ ...REQUIRED, METRICS_TOKEN: "" }).METRICS_TOKEN).toBeUndefined();
  });

  it("still rejects a too-short non-empty METRICS_TOKEN", () => {
    expect(envSchema.safeParse({ ...REQUIRED, METRICS_TOKEN: "short" }).success).toBe(false);
  });

  it("accepts a valid METRICS_TOKEN", () => {
    const token = "a".repeat(16);
    expect(envSchema.parse({ ...REQUIRED, METRICS_TOKEN: token }).METRICS_TOKEN).toBe(token);
  });

  it.each([
    ["API_PORT out of range", { API_PORT: "70000" }],
    ["API_PORT not an integer", { API_PORT: "80.5" }],
    ["NODE_ENV unknown", { NODE_ENV: "staging" }],
    ["API_LOG_LEVEL unknown", { API_LOG_LEVEL: "verbose" }],
    ["WEB_ORIGIN not a URL", { WEB_ORIGIN: "localhost:3000" }],
    ["NEXTAUTH_SECRET too short", { NEXTAUTH_SECRET: "short" }],
    ["TRUSTED_PROXY_HOPS negative", { TRUSTED_PROXY_HOPS: "-1" }],
    ["TRUSTED_PROXY_HOPS not an integer", { TRUSTED_PROXY_HOPS: "1.5" }],
  ])("rejects: %s", (_name, override) => {
    expect(envSchema.safeParse({ ...REQUIRED, ...override }).success).toBe(false);
  });

  it("requires DATABASE_URL", () => {
    const result = envSchema.safeParse({ ...REQUIRED, DATABASE_URL: "" });

    expect(result.success).toBe(false);
  });
});

describe("environment predicates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reports the test environment", () => {
    expect(isTest()).toBe(true);
    expect(isProduction()).toBe(false);
    expect(isDevelopment()).toBe(false);
  });

  it.each([
    ["production", { isProduction: true, isDevelopment: false, isTest: false }],
    ["development", { isProduction: false, isDevelopment: true, isTest: false }],
  ])("reports %s after re-import", async (nodeEnv, expected) => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", nodeEnv);

    const mod = await import("../../../src/config/env");

    expect({
      isProduction: mod.isProduction(),
      isDevelopment: mod.isDevelopment(),
      isTest: mod.isTest(),
    }).toEqual(expected);
  });
});

describe("bootstrap validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the Zod error and exits with code 1 on invalid env", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    parseEnv({ ...REQUIRED, NEXTAUTH_SECRET: "to-short" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledOnce();

    const errorMessage = errorSpy.mock.calls[0]?.[0] as string | undefined;

    expect(errorMessage).toContain("Invalid environment variables:");
    expect(errorMessage).toContain("NEXTAUTH_SECRET");
  });
});

describe("env mock parity", () => {
  it("keeps __mocks__/env.ts in sync with tests/setup.ts", () => {
    expect(mockEnv.NEXTAUTH_SECRET).toBe(process.env.NEXTAUTH_SECRET);
    expect(mockEnv.WEB_ORIGIN).toBe(process.env.WEB_ORIGIN);
    expect(mockEnv.API_PORT).toBe(Number(process.env.API_PORT));
  });
});
