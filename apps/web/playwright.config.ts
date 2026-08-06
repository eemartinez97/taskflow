import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
import path from "node:path";

const AUTH_FILE = path.join(process.cwd(), "playwright/.auth/user.json");

/**
 * Second gate on the /api/test/* backdoor routes, on top of
 * ENABLE_TEST_ROUTES - see lib/http/test-route-guard.ts. Generated fresh
 * per config load (once per `playwright test` invocation) and never written
 * to any deployment's env, so a leaked/misconfigured ENABLE_TEST_ROUTES flag
 * alone can no longer reach these routes.
 *
 * Assigning it onto process.env here (not just the webServer's env below)
 * makes it visible to global-setup.ts, global-teardown.ts, and every test
 * file/worker - they're all spawned as children of THIS process, after this
 * module has already run, so they inherit the mutated env.
 */
const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET ?? randomBytes(32).toString("hex");
process.env.E2E_TEST_SECRET = E2E_TEST_SECRET;

/**
 * Playwright 1.60 E2E configuration.
 *
 * Auth strategy: `globalSetup` performs ONE real registration/login flow
 * through the UI and persists the resulting storageState to AUTH_FILE.
 * Every test starts pre-authenticated via `use.storageState` below.
 * Specs that must start anonymous (auth.spec.ts) opt out per-file with:
 *   test.use({ storageState: { cookies: [], origins: [] } });
 *
 * Two web servers: apps/api (Express + tRPC) is a hard dependency of every
 * page in apps/web (getServerTRPC reads from it on every server render), so
 * it must be up and healthy BEFORE globalSetup's first navigation.
 *
 * `pnpm --filter <pkg> dev` resolves the monorepo workspace root
 * automatically regardless of the current working directory, so these
 * commands work correctly even though this config file lives in apps/web.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI && { workers: 1 }),
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },

  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    storageState: AUTH_FILE,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],

  webServer: [
    {
      command: "pnpm --filter @taskflow/api dev",
      url: "http://localhost:8000/healthz",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // ALWAYS a production build, even locally - `next dev` compiles routes
      // on-demand per request. Under E2E's real concurrency (multiple
      // browser contexts hitting the same server at once, amplified further
      // by --repeat-each), that lazy compilation queues up and individual
      // navigations start exceeding the test timeout - a resource-contention
      // flake, not a logic bug. A production build is pre-compiled, so
      // request latency stays flat regardless of concurrency.
      command: "pnpm --filter @taskflow/web build && pnpm --filter @taskflow/web start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      // 180s covers the build step (which now always runs) plus server boot.
      timeout: 180_000,
      env: { ENABLE_TEST_ROUTES: "true", E2E_TEST_SECRET },
    },
  ],
});
