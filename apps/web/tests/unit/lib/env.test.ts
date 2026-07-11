import { VALID_FULL_ENV, VALID_PUBLIC_ENV, VALID_SERVER_ENV } from "@/tests/helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as envModule from "@/lib/env";

/**
 * Test for lib/env.ts
 *
 * NOTE: lib/env.ts validates process.env at module load time (singleton).
 * Tests that check the failure branches MUST:
 *   1. Call vi.resetModules() to clear the module cache
 *   2. Stub env vars BEFORE the dynamic import
 *   3. Restore stubs after test
 */

// -- Schema validation (pure Zod) --
// Import the schema directly - this does NOT trigger the singleton parse.

describe("serverEnvSchema", () => {
  // Import lazily per test to avoid the singleton
  let serverEnvSchema: typeof envModule.serverEnvSchema;

  beforeEach(async () => {
    vi.resetModules();
    ({ serverEnvSchema } = await import("@/lib/env"));
  });

  it("parse all valid fields correctly", () => {
    const result = serverEnvSchema.parse(VALID_SERVER_ENV);
    expect(result.DATABASE_URL).toBe(VALID_SERVER_ENV.DATABASE_URL);
    expect(result.NEXTAUTH_SECRET).toBe(VALID_SERVER_ENV.NEXTAUTH_SECRET);
    expect(result.NEXTAUTH_URL).toBe(VALID_SERVER_ENV.NEXTAUTH_URL);
  });

  it("defaults NODE_ENV to 'development' when not set", () => {
    const { NODE_ENV: _, ...withoutNodeEnv } = VALID_SERVER_ENV;
    expect(serverEnvSchema.parse(withoutNodeEnv).NODE_ENV).toBe("development");
  });

  it("accepts all valid NODE_ENV values", () => {
    for (const env of ["development", "test", "production"] as const) {
      expect(serverEnvSchema.parse({ ...VALID_SERVER_ENV, NODE_ENV: env }).NODE_ENV).toBe(env);
    }
  });

  it.each([
    { desc: "empty DATABASE_URL", data: { ...VALID_SERVER_ENV, DATABASE_URL: "" } },
    {
      desc: "NEXTAUTH_SECRET shorter than 16 chars",
      data: { ...VALID_SERVER_ENV, NEXTAUTH_SECRET: "short" },
    },
    { desc: "unknown NODE_ENV value", data: { ...VALID_SERVER_ENV, NODE_ENV: "staging" } },
    {
      desc: "missing DATABASE_URL",
      data: (({ DATABASE_URL: _, ...rest }) => rest)(VALID_SERVER_ENV),
    },
  ])("rejects: $desc", ({ data }) => {
    expect(serverEnvSchema.safeParse(data).success).toBe(false);
  });

  it("rejects invalid NEXTAUTH_URL", () => {
    expect(() => serverEnvSchema.parse({ ...VALID_SERVER_ENV, NEXTAUTH_URL: "not-a-url" }))
      .toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "code": "invalid_format",
          "format": "url",
          "path": [
            "NEXTAUTH_URL"
          ],
          "message": "NEXTAUTH_URL must be a valid URL"
        }
      ]]
    `);
  });
});

describe("publicEnvSchema", () => {
  let publicEnvSchema: typeof envModule.publicEnvSchema;

  beforeEach(async () => {
    vi.resetModules();
    ({ publicEnvSchema } = await import("@/lib/env"));
  });

  it("parses a valid a NEXT_PUBLIC_SOCKET_URL", () => {
    const result = publicEnvSchema.parse(VALID_PUBLIC_ENV);
    expect(result.NEXT_PUBLIC_SOCKET_URL).toBe(VALID_PUBLIC_ENV.NEXT_PUBLIC_SOCKET_URL);
  });

  it("parses valid NEXT_PUBLIC_WEB_URL", () => {
    const result = publicEnvSchema.parse(VALID_PUBLIC_ENV);
    expect(result.NEXT_PUBLIC_WEB_URL).toBe(VALID_PUBLIC_ENV.NEXT_PUBLIC_WEB_URL);
  });

  it("defaults NEXT_PUBLIC_SOCKET_URL when not set", () => {
    const result = publicEnvSchema.parse({ NEXT_PUBLIC_WEB_URL: "http://localhost:3000" });
    expect(result.NEXT_PUBLIC_SOCKET_URL).toBe("http://localhost:8000");
  });

  it("defaults NEXT_PUBLIC_WEB_URL to http://localhost:3000 when not set", () => {
    const result = publicEnvSchema.parse({
      NEXT_PUBLIC_SOCKET_URL: "http://localhost:8000",
    });
    expect(result.NEXT_PUBLIC_WEB_URL).toBe("http://localhost:3000");
  });

  it.each([
    {
      desc: "invalid NEXT_PUBLIC_SOCKET_URL",
      data: { ...VALID_PUBLIC_ENV, NEXT_PUBLIC_SOCKET_URL: "bad" },
    },
    {
      desc: "invalid NEXT_PUBLIC_WEB_URL",
      data: { ...VALID_PUBLIC_ENV, NEXT_PUBLIC_WEB_URL: "not-a-url" },
    },
  ])("rejects: $desc", ({ data }) => {
    expect(publicEnvSchema.safeParse(data).success).toBe(false);
  });
});

describe("fullEnvSchema", () => {
  let fullEnvSchema: typeof envModule.fullEnvSchema;

  beforeEach(async () => {
    vi.resetModules();
    ({ fullEnvSchema } = await import("@/lib/env"));
  });

  it("is the merge of serverEnvSchema and publicEnvSchema", () => {
    const result = fullEnvSchema.parse(VALID_FULL_ENV);
    expect(result.DATABASE_URL).toBe(VALID_FULL_ENV.DATABASE_URL);
    expect(result.NEXT_PUBLIC_WEB_URL).toBe(VALID_FULL_ENV.NEXT_PUBLIC_WEB_URL);
  });

  it("rejects when any required server field is missing", () => {
    const { DATABASE_URL: _, ...withoutDb } = VALID_FULL_ENV;
    expect(() => fullEnvSchema.parse(withoutDb)).toThrow();
  });
});

// -- Singleton failure branches --

describe("serverEnv singleton - parseServerEnv()", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    {
      desc: "with a readable message when DATABASE_URL is missing",
      stubEnv: () => vi.stubEnv("DATABASE_URL", ""),
    },
    {
      desc: "when NEXTAUTH_SECRET is too short",
      stubEnv: () => vi.stubEnv("NEXTAUTH_SECRET", "short"),
    },
    {
      desc: "when NEXTAUTH_URL is not a valid URL",
      stubEnv: () => vi.stubEnv("NEXTAUTH_URL", "not-a-url"),
    },
  ])("throws: $desc", async ({ stubEnv }) => {
    stubEnv();
    await expect(import("@/lib/env.server")).rejects.toThrow(
      "Invalid server environment variables",
    );
  });
});

describe("publicEnv singleton - parsePublicEnv()", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    {
      desc: "when NEXT_PUBLIC_SOCKET_URL is invalid",
      stubEnv: () => vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "not-a-url"),
    },
    {
      desc: "when NEXT_PUBLIC_WEB_URL is invalid",
      stubEnv: () => vi.stubEnv("NEXT_PUBLIC_WEB_URL", "not-a-url"),
    },
  ])("throws: $desc", async ({ stubEnv }) => {
    stubEnv();
    await expect(import("@/lib/env.client")).rejects.toThrow(
      "Invalid public environment variables",
    );
  });
});
