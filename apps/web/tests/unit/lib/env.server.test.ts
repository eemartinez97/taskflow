import { afterEach, describe, expect, it, vi } from "vitest";
import { VALID_SERVER_ENV } from "@/tests/support/fixtures";

vi.mock("server-only", () => import("@/tests/mocks/server-only"));

const ORIGINAL_ENV = { ...process.env };

describe("serverEnv (env.server.ts)", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("parses successfully with a valid environment", async () => {
    Object.assign(process.env, VALID_SERVER_ENV);
    const { serverEnv } = await import("@/lib/env.server");
    expect(serverEnv.NEXTAUTH_URL).toBe(VALID_SERVER_ENV.NEXTAUTH_URL);
  });

  it("throws a descriptive error when required variables are invalid", async () => {
    Object.assign(process.env, VALID_SERVER_ENV, { NEXTAUTH_SECRET: "x" });
    await expect(import("@/lib/env.server")).rejects.toThrow(/Invalid server environment/);
  });
});
