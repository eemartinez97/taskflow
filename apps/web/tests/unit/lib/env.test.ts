import { describe, expect, it } from "vitest";
import { fullEnvSchema } from "@/lib/env";
import { VALID_FULL_ENV } from "@/tests/support/fixtures";

describe("fullEnvSchema", () => {
  it("accepts a fully valid environment", () => {
    expect(fullEnvSchema.safeParse(VALID_FULL_ENV).success).toBe(true);
  });

  it("rejects a NEXTAUTH_SECRET shorter than 16 characters", () => {
    const result = fullEnvSchema.safeParse({ ...VALID_FULL_ENV, NEXTAUTH_SECRET: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) NEXTAUTH_URL", () => {
    const result = fullEnvSchema.safeParse({ ...VALID_FULL_ENV, NEXTAUTH_URL: "ftp://x" });
    expect(result.success).toBe(false);
  });

  it("defaults NEXT_PUBLIC_API_URL when omitted", () => {
    const { NEXT_PUBLIC_API_URL: _omit, ...rest } = VALID_FULL_ENV;
    const result = fullEnvSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.NEXT_PUBLIC_API_URL).toBe("http://localhost:8000");
  });

  it("defaults NODE_ENV to 'development' when omitted", () => {
    const { NODE_ENV: _omit, ...rest } = VALID_FULL_ENV;
    const result = fullEnvSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    const { DATABASE_URL: _omit, ...rest } = VALID_FULL_ENV;
    expect(fullEnvSchema.safeParse(rest).success).toBe(false);
  });

  it("defaults PASSWORD_CHANGED_AT_CACHE_TTL_MS to 60s when omitted", () => {
    const { PASSWORD_CHANGED_AT_CACHE_TTL_MS: _omit, ...rest } = VALID_FULL_ENV;
    const result = fullEnvSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PASSWORD_CHANGED_AT_CACHE_TTL_MS).toBe(60_000);
  });

  it("coerces PASSWORD_CHANGED_AT_CACHE_TTL_MS from string (playwright.config.ts sets it via env)", () => {
    const result = fullEnvSchema.safeParse({
      ...VALID_FULL_ENV,
      PASSWORD_CHANGED_AT_CACHE_TTL_MS: "2000",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PASSWORD_CHANGED_AT_CACHE_TTL_MS).toBe(2000);
  });

  it("treats INTERNAL_API_SECRET as optional outside production", () => {
    const result = fullEnvSchema.safeParse(VALID_FULL_ENV);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.INTERNAL_API_SECRET).toBeUndefined();
  });

  it("rejects an INTERNAL_API_SECRET shorter than 32 characters", () => {
    const result = fullEnvSchema.safeParse({
      ...VALID_FULL_ENV,
      INTERNAL_API_SECRET: "short",
    });
    expect(result.success).toBe(false);
  });

  describe("production requirements", () => {
    it("rejects production with no INTERNAL_API_SECRET", () => {
      const result = fullEnvSchema.safeParse({ ...VALID_FULL_ENV, NODE_ENV: "production" });
      expect(result.success).toBe(false);
    });

    it("accepts production with INTERNAL_API_SECRET set", () => {
      const result = fullEnvSchema.safeParse({
        ...VALID_FULL_ENV,
        NODE_ENV: "production",
        INTERNAL_API_SECRET: "a".repeat(32),
      });
      expect(result.success).toBe(true);
    });
  });
});
