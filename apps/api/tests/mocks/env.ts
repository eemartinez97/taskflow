import { vi } from "vitest";

/**
 * Shared factory for mocking src/config/env.ts across unit tests.
 *
 * Usage in any test file:
 *
 *   vi.mock("../../../src/config/env.js", async () => {
 *     const { envMockFactory } = await import("../../mocks/env.js");
 *     return envMockFactory();
 *   });
 *
 * The factory is a function (not a plain object) so each test file
 * gets its own vi.fn() instances - avoids shared state between files.
 */
export function envMockFactory(): Record<string, unknown> {
  return {
    env: {
      NODE_ENV: "development",
      API_LOG_LEVEL: "silent",
      API_PORT: 8001,
      WEB_ORIGIN: "http://localhost:3000",
      DATABASE_URL: "postgresql://taskflow:changeme@localhost:5432/taskflow_test",
      NEXTAUTH_SECRET: "test-secret-value-at-least-16-chars",
    },
    isProduction: vi.fn(() => false),
    isDevelopment: vi.fn(() => true),
    isTest: vi.fn(() => true),
    envSchema: vi.fn(),
  };
}
