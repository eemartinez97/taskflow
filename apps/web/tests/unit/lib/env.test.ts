import { describe, expect, it, afterEach } from "vitest";
import { fullEnvSchema } from "@/lib/env";
import { VALID_FULL_ENV } from "@/tests/support/fixtures";

const ORIGINAL_ENABLE_TEST_ROUTES = process.env.ENABLE_TEST_ROUTES;
const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

afterEach(() => {
  process.env.ENABLE_TEST_ROUTES = ORIGINAL_ENABLE_TEST_ROUTES;
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

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

  describe("EMAIL_FROM", () => {
    it("accepts a bare email address", () => {
      const result = fullEnvSchema.safeParse({ ...VALID_FULL_ENV, EMAIL_FROM: "onboarding@resend.dev" });
      expect(result.success).toBe(true);
    });

    it("accepts a fully-bracketed 'Name <email>' address", () => {
      const result = fullEnvSchema.safeParse({
        ...VALID_FULL_ENV,
        EMAIL_FROM: "TaskFlow <onboarding@resend.dev>",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a 'Name <email' value missing the closing bracket", () => {
      const result = fullEnvSchema.safeParse({
        ...VALID_FULL_ENV,
        EMAIL_FROM: "TaskFlow <onboarding@resend.dev",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a 'Name email>' value missing the opening bracket", () => {
      const result = fullEnvSchema.safeParse({
        ...VALID_FULL_ENV,
        EMAIL_FROM: "TaskFlow onboarding@resend.dev>",
      });
      expect(result.success).toBe(false);
    });

    it("accepts the Resend sandbox default outside production", () => {
      const result = fullEnvSchema.safeParse(VALID_FULL_ENV);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.EMAIL_FROM).toBe("TaskFlow <onboarding@resend.dev>");
    });
  });

  describe("production requirements", () => {
    it("rejects production with no RESEND_API_KEY", () => {
      const result = fullEnvSchema.safeParse({ ...VALID_FULL_ENV, NODE_ENV: "production" });
      expect(result.success).toBe(false);
    });

    it("rejects production still using the Resend sandbox EMAIL_FROM default", () => {
      const result = fullEnvSchema.safeParse({
        ...VALID_FULL_ENV,
        NODE_ENV: "production",
        RESEND_API_KEY: "re_live_key",
      });
      expect(result.success).toBe(false);
    });

    it("rejects production with a bare onboarding@resend.dev EMAIL_FROM", () => {
      const result = fullEnvSchema.safeParse({
        ...VALID_FULL_ENV,
        NODE_ENV: "production",
        RESEND_API_KEY: "re_live_key",
        EMAIL_FROM: "onboarding@resend.dev",
      });
      expect(result.success).toBe(false);
    });

    it("accepts production with a real API key and a non-sandbox EMAIL_FROM", () => {
      const result = fullEnvSchema.safeParse({
        ...VALID_FULL_ENV,
        NODE_ENV: "production",
        RESEND_API_KEY: "re_live_key",
        EMAIL_FROM: "TaskFlow <hello@taskflow.dev>",
      });
      expect(result.success).toBe(true);
    });

    it("exempts ENABLE_TEST_ROUTES=true from the production email requirements (E2E always builds as NODE_ENV=production)", () => {
      process.env.ENABLE_TEST_ROUTES = "true";

      const result = fullEnvSchema.safeParse({ ...VALID_FULL_ENV, NODE_ENV: "production" });

      expect(result.success).toBe(true);
    });

    it("still enforces the production email requirements when ENABLE_TEST_ROUTES is not 'true'", () => {
      process.env.ENABLE_TEST_ROUTES = "false";

      const result = fullEnvSchema.safeParse({ ...VALID_FULL_ENV, NODE_ENV: "production" });

      expect(result.success).toBe(false);
    });

    it("does NOT exempt ENABLE_TEST_ROUTES=true when DATABASE_URL is not local (a leaked flag must not bypass real production checks)", () => {
      process.env.ENABLE_TEST_ROUTES = "true";
      process.env.DATABASE_URL = "postgresql://user:pass@db.production-host.example.com:5432/app";

      const result = fullEnvSchema.safeParse({ ...VALID_FULL_ENV, NODE_ENV: "production" });

      expect(result.success).toBe(false);
    });
  });
});
