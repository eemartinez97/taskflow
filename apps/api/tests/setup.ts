/**
 * Unit test global setup.
 *
 * MODULE RESOLUTION
 * ─────────────────────────────────────────────────────────────
 * @taskflow/database -> tests/mocks/database-mock.ts  (alias, "unit" project only)
 * src/config/env     -> real module by default; tests opt in with
 *                       vi.mock("…/config/env") which picks up
 *                       src/config/__mocks__/env.ts automatically
 * src/config/logger  -> tests/mocks/logger.ts   (vi.mock global)
 * pino-http          -> tests/mocks/http.ts     (vi.mock global)
 *
 * Integration tests live in tests/integration/ and run under a separate Vitest
 * project with no alias - they hit a real Postgres via Testcontainers.
 */

// Must run before any module reads process.env.
// KEEP NEXTAUTH_SECRET IN SYNC with src/config/__mocks__/env.ts

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";
process.env.NEXTAUTH_SECRET = "test-secret-value-at-least-16-chars";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.API_PORT = "8001";
process.env.API_LOG_LEVEL = "silent";
process.env.TRUSTED_PROXY_HOPS = "1";

import { beforeEach, vi } from "vitest";
import { mockLogger } from "./mocks/logger";
import { resetAllTestMocks } from "./support/reset";

// Global mocks
vi.mock("../src/config/logger", () => ({ logger: mockLogger }));
vi.mock("pino-http", () => import("./mocks/http"));

// Runs BEFORE every per-file beforeEach (setup-file hooks register first),
// so tests can safely configure mocks in their own beforeEach.
beforeEach(() => {
  resetAllTestMocks();
});
