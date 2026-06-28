import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 1.60 E2E configuration.
 * Tests run against the local dev server started by `pnpm dev`.
 * In CI, the web server is started automatically via `webServer`
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Conditional spread - key is absent when not CI, not `undefined`
  ...(process.env.CI && { workers: 1 }),
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
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

  // Automatically start the dev server when running E2E locally
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
