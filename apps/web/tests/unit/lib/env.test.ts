import { VALID_FULL_ENV, VALID_PUBLIC_ENV, VALID_SERVER_ENV } from "@/tests/helpers.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as envModule from "../../../lib/env.js";

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
    ({ serverEnvSchema } = await import("../../../lib/env.js"));
  });

  it("parse all valid fields correctly", () => {
    const result = serverEnvSchema.parse(VALID_SERVER_ENV);
    expect(result.DATABASE_URL).toBe(VALID_SERVER_ENV.DATABASE_URL);
    expect(result.NEXTAUTH_SECRET).toBe(VALID_SERVER_ENV.NEXTAUTH_SECRET);
    expect(result.NEXTAUTH_URL).toBe(VALID_SERVER_ENV.NEXTAUTH_URL);
  });

  it("defaults NODE_ENV to 'development' when not set", () => {
    const { NODE_ENV: _, ...withoutNodeEnv } = VALID_SERVER_ENV;
    void _;

    const result = serverEnvSchema.parse(withoutNodeEnv);
    expect(result.NODE_ENV).toBe("development");
  });

  it("accepts all valid NODE_ENV values", () => {
    const envs = ["development", "test", "production"] as const;
    for (const env of envs) {
      expect(serverEnvSchema.parse({ ...VALID_SERVER_ENV, NODE_ENV: env }).NODE_ENV).toBe(env);
    }
  });

  it("rejects empty DATABASE_URL", () => {
    expect(() => serverEnvSchema.parse({ ...VALID_SERVER_ENV, DATABASE_URL: "" })).toThrow();
  });

  it("rejects NEXTAUTH_SECRET shorter than 16 chars", () => {
    expect(() =>
      serverEnvSchema.parse({ ...VALID_SERVER_ENV, NEXTAUTH_SECRET: "too_short" }),
    ).toThrow();
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

  it("rejects unknown NODE_ENV value", () => {
    expect(() => serverEnvSchema.parse({ ...VALID_SERVER_ENV, NODE_ENV: "staging" })).toThrow();
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL: _, ...without } = VALID_SERVER_ENV;
    void _;
    expect(() => serverEnvSchema.parse(without)).toThrow();
  });
});

describe("publicEnvSchema", () => {
  let publicEnvSchema: typeof envModule.publicEnvSchema;

  beforeEach(async () => {
    vi.resetModules();
    ({ publicEnvSchema } = await import("../../../lib/env.js"));
  });

  it("parses a valid a NEXT_PUBLIC_SOCKET_URL", () => {
    const result = publicEnvSchema.parse(VALID_PUBLIC_ENV);
    expect(result.NEXT_PUBLIC_SOCKET_URL).toBe(VALID_PUBLIC_ENV.NEXT_PUBLIC_SOCKET_URL);
  });

  it("defaults NEXT_PUBLIC_SOCKET_URL to http://localhost:8000 when not set", () => {
    const result = publicEnvSchema.parse({});
    expect(result.NEXT_PUBLIC_SOCKET_URL).toBe("http://localhost:8000");
  });

  it("rejects an invalid NEXT_PUBLIC_SOCKET_URL", () => {
    expect(() => publicEnvSchema.parse({ NEXT_PUBLIC_SOCKET_URL: "not-a-url" })).toThrow();
  });
});

describe("fullEnvSchema", () => {
  let fullEnvSchema: typeof envModule.fullEnvSchema;

  beforeEach(async () => {
    vi.resetModules();
    ({ fullEnvSchema } = await import("../../../lib/env.js"));
  });

  it("is the merge of serverEnvSchema and publicEnvSchema", () => {
    const result = fullEnvSchema.parse(VALID_FULL_ENV);
    expect(result.DATABASE_URL).toBe(VALID_FULL_ENV.DATABASE_URL);
    expect(result.NEXT_PUBLIC_SOCKET_URL).toBe(VALID_FULL_ENV.NEXT_PUBLIC_SOCKET_URL);
  });

  it("rejects when any required server field is missing", () => {
    const { DATABASE_URL: _, ...withoutDb } = VALID_FULL_ENV;
    void _;
    expect(() => fullEnvSchema.parse(withoutDb)).toThrow();
  });
});

// -- Singleton failure branches --

describe("serverEnv singleton - parseServerEnv()", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws with a readable message when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(import("../../../lib/env.js")).rejects.toThrow(
      "Invalid server environment variables",
    );
  });

  it("throws when NEXTAUTH_SECRET is too short", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "short");

    await expect(import("../../../lib/env.js")).rejects.toThrow(
      "Invalid server environment variables",
    );
  });

  it("throws when NEXTAUTH_URL is not a valid URL", async () => {
    vi.stubEnv("NEXTAUTH_URL", "not-a-url");

    await expect(import("../../../lib/env.js")).rejects.toThrow(
      "Invalid server environment variables",
    );
  });
});

describe("publicEnv singleton - parsePublicEnv()", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when NEXT_PUBLIC_SOCKET_URL is an invalid URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "not-a-url");

    await expect(import("../../../lib/env.js")).rejects.toThrow(
      "Invalid public environment variables",
    );
  });
});
