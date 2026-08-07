import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regression guard for the NEXT_STANDALONE_BUILD gate in next.config.ts.
 *
 * WHY THIS EXISTS: `output: "standalone"` makes `next start` refuse to run
 * at all ("does not work with output: standalone"). Local dev builds and
 * Playwright's E2E webServer (`next build && next start`, see
 * playwright.config.ts) depend on the plain build - if someone edits
 * apps/web/Dockerfile and drops the `ENV NEXT_STANDALONE_BUILD=true` line
 * (or next.config.ts's check for it), Docker's own e2e-equivalent smoke
 * test (`.github/workflows/ci.yml`'s docker-build job) would still pass,
 * because Docker always sets the var - only local `pnpm test:e2e` would
 * silently break, and package.json's `build` script gives no signal either.
 * This test is what actually catches that, independent of anyone reading
 * the comments in next.config.ts or the Dockerfile.
 */
describe("next.config.ts standalone output gate", () => {
  afterEach(() => {
    delete process.env.NEXT_STANDALONE_BUILD;
    vi.resetModules();
  });

  it("does NOT set output: standalone when NEXT_STANDALONE_BUILD is unset (local dev/build, E2E)", async () => {
    delete process.env.NEXT_STANDALONE_BUILD;
    vi.resetModules();

    const { default: nextConfig } = await import("../../next.config");

    expect(nextConfig.output).toBeUndefined();
  });

  it("sets output: standalone when NEXT_STANDALONE_BUILD=true (apps/web/Dockerfile only)", async () => {
    process.env.NEXT_STANDALONE_BUILD = "true";
    vi.resetModules();

    const { default: nextConfig } = await import("../../next.config");

    expect(nextConfig.output).toBe("standalone");
    expect(nextConfig.outputFileTracingRoot).toBeDefined();
  });
});
