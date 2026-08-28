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

  it("treats METRICS_TOKEN: '' the same as unset (e.g. explicitly cleared in .env to disable /metrics)", () => {
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

  it("defaults EMAIL_FROM to the Resend sandbox address when omitted", () => {
    expect(envSchema.parse(REQUIRED).EMAIL_FROM).toBe("TaskFlow <onboarding@resend.dev>");
  });

  it("rejects an EMAIL_FROM missing a bracket", () => {
    const result = envSchema.safeParse({ ...REQUIRED, EMAIL_FROM: "TaskFlow <a@b.com" });
    expect(result.success).toBe(false);
  });

  it("treats RESEND_API_KEY: '' the same as unset", () => {
    expect(envSchema.parse({ ...REQUIRED, RESEND_API_KEY: "" }).RESEND_API_KEY).toBeUndefined();
  });

  it("treats INTERNAL_API_SECRET: '' the same as unset", () => {
    expect(
      envSchema.parse({ ...REQUIRED, INTERNAL_API_SECRET: "" }).INTERNAL_API_SECRET,
    ).toBeUndefined();
  });

  it("rejects an INTERNAL_API_SECRET shorter than 32 characters", () => {
    const result = envSchema.safeParse({
      ...REQUIRED,
      INTERNAL_API_SECRET: "a".repeat(31),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 32-character INTERNAL_API_SECRET", () => {
    const secret = "a".repeat(32);
    expect(envSchema.parse({ ...REQUIRED, INTERNAL_API_SECRET: secret }).INTERNAL_API_SECRET).toBe(
      secret,
    );
  });

  describe("production requirements", () => {
    const PROD_READY = {
      ...REQUIRED,
      NODE_ENV: "production",
      RESEND_API_KEY: "re_live_key",
      EMAIL_FROM: "TaskFlow <hello@taskflow.dev>",
      INTERNAL_API_SECRET: "a".repeat(32),
    };

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("rejects production with no RESEND_API_KEY", () => {
      const { RESEND_API_KEY: _omit, ...rest } = PROD_READY;
      expect(envSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects production still using the sandbox EMAIL_FROM default", () => {
      const { EMAIL_FROM: _omit, ...rest } = PROD_READY;
      expect(envSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects production with no INTERNAL_API_SECRET", () => {
      const { INTERNAL_API_SECRET: _omit, ...rest } = PROD_READY;
      expect(envSchema.safeParse(rest).success).toBe(false);
    });

    it("accepts production with every required secret set", () => {
      expect(envSchema.safeParse(PROD_READY).success).toBe(true);
    });

    it("flags EXACTLY the known set of production-only issues when only shape-required fields are given - guards scripts/check-env-parity.mjs's hand-maintained PRODUCTION_ONLY_REQUIRED_KEYS list against silently drifting if a future superRefine adds a new conditional requirement without updating that list too", () => {
      const result = envSchema.safeParse({ ...REQUIRED, NODE_ENV: "production" });

      expect(result.success).toBe(false);
      if (result.success) return;

      const issuePaths = new Set(result.error.issues.map((issue) => issue.path.join(".")));
      expect(issuePaths).toEqual(new Set(["RESEND_API_KEY", "EMAIL_FROM", "INTERNAL_API_SECRET"]));
    });

    it("exempts an E2E run (ENABLE_TEST_ROUTES=true + local DATABASE_URL) from the mail-sending requirements", () => {
      vi.stubEnv("ENABLE_TEST_ROUTES", "true");
      const { RESEND_API_KEY: _a, EMAIL_FROM: _b, ...rest } = PROD_READY;

      expect(envSchema.safeParse(rest).success).toBe(true);
    });

    it("does NOT exempt an E2E run from requiring INTERNAL_API_SECRET - playwright.config.ts always sets a real one", () => {
      vi.stubEnv("ENABLE_TEST_ROUTES", "true");
      const { INTERNAL_API_SECRET: _omit, ...rest } = PROD_READY;

      expect(envSchema.safeParse(rest).success).toBe(false);
    });

    it("does NOT exempt ENABLE_TEST_ROUTES=true when DATABASE_URL is not local", () => {
      vi.stubEnv("ENABLE_TEST_ROUTES", "true");
      vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.production-host.example.com:5432/app");
      const { RESEND_API_KEY: _a, ...rest } = PROD_READY;

      expect(envSchema.safeParse(rest).success).toBe(false);
    });
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
    if (nodeEnv === "production") {
      // Real module re-import runs the full superRefine - satisfy its
      // production-only requirements so this test stays about the
      // isProduction/isDevelopment/isTest predicates, not env validation.
      vi.stubEnv("RESEND_API_KEY", "re_live_key");
      vi.stubEnv("EMAIL_FROM", "TaskFlow <hello@taskflow.dev>");
      vi.stubEnv("INTERNAL_API_SECRET", "a".repeat(32));
    }

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
