/**
 * Vitest global setup for apps/api.
 * Runs before every test file.
 * Provides the minimum valid env vars so env.ts does not call process.exit(1).
 */

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";
process.env.NEXTAUTH_SECRET = "test-secret-value-at-least-16-chars";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.API_PORT = "8001";
process.env.API_LOG_LEVEL = "silent";
