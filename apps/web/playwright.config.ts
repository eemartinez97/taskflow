import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const AUTH_FILE = path.join(process.cwd(), "playwright/.auth/user.json");

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
      command: process.env.CI
        ? "pnpm --filter @taskflow/web build && pnpm --filter @taskflow/web start"
        : "pnpm --filter @taskflow/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: process.env.CI ? 180_000 : 120_000,
    },
  ],
});
