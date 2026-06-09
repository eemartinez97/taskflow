import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Tests the process.exit(1) branch in env.ts when required vars are missing.
 * This file is isolated from env.test.ts because it mocks process.exit
 * and needs vi.resetModules() to force re-evaluation of the module.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env.ts - startup failure branch", () => {
  it("calls process.exit(1) when DATABASE_URL is missing", async () => {
    // Stub process.exit to prevent the test runner from actually exiting
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    // Stub console.error to suppress the error output in test logs
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Remove required vars so the schema validation fails
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");

    await expect(import("../../../src/config/env.js")).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
