/**
 * Shared environment variables applied across all Vitest test suites.
 *
 * Satisfies both serverEnvSchema and publicEnvSchema so any module that
 * imports from lib/env.ts does not throw during test collection.
 * NODE_ENV is set to "test" automatically by Vitest - never reassign it here.
 */
process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";
process.env.NEXTAUTH_SECRET = "test-secret-value-at-least-16-chars";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
process.env.NEXT_PUBLIC_WEB_URL = "http://localhost:3000";
