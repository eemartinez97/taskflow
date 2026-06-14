/**
 * Unit test global setup.
 *
 * MODULE RESOLUTION (important for understanding test behavior):
 * ─────────────────────────────────────────────────────────────
 * @taskflow/database -> tests/mocks/database-mock.ts  (alias, unit project only)
 * src/config/env.js  -> real module by default; tests that need mock call vi.mock()
 * src/config/logger  -> tests/mocks/logger.ts          (vi.mock global)
 * pino-http         -> tests/mocks/http.ts             (vi.mock global)
 *
 * Integration tests (tests/integration/) bypass the database alias
 * and connect to a real Postgres 18 via Testcontainers.
 */

// Provide minimum valid env vars before any module reads process.env
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";
process.env.NEXTAUTH_SECRET = "test-secret-value-at-least-16-chars";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.API_PORT = "8001";
process.env.API_LOG_LEVEL = "silent";

import { vi } from "vitest";
import { mockLogger } from "./mocks/logger.js";

// Global mocks

vi.mock("../src/config/logger.js", () => ({ logger: mockLogger }));

vi.mock("pino-http", () => import("./mocks/http.js"));
