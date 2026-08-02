import { afterEach, describe, expect, it, vi } from "vitest";

import { VALID_PUBLIC_ENV } from "@/tests/support/fixtures";

const ORIGINAL_ENV = { ...process.env };

describe("publicEnv (env.client.ts)", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("parses successfully with a valid public environment", async () => {
    Object.assign(process.env, VALID_PUBLIC_ENV);
    const { publicEnv } = await import("@/lib/env.client");
    expect(publicEnv.NEXT_PUBLIC_API_URL).toBe(VALID_PUBLIC_ENV.NEXT_PUBLIC_API_URL);
  });

  it("throws a descriptive error for an invalid NEXT_PUBLIC_API_URL", async () => {
    process.env.NEXT_PUBLIC_API_URL = "not-a-url";
    await expect(import("@/lib/env.client")).rejects.toThrow(/Invalid public environment/);
  });
});
