// Extend Vitest `expect` with @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveClass, toBeDisabled, etc.)
import "@testing-library/jest-dom/vitest";

// -- Minimal valid environment for all web tests --
// These values satisfy both serverEnvSchema and publicEnvSchema so that
// any module importing fro lib/env.ts does not throw during test runs.
//
// NODE_ENV is set to "test" automatically by Vitest — do not reassign
// (it is readonly in @types/node)
process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";
process.env.NEXTAUTH_SECRET = "test-secret-value-at-least-16-chars";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SOCKET_URL = "http://localhost:8000";
process.env.NEXT_PUBLIC_WEB_URL = "http://localhost:3000";
