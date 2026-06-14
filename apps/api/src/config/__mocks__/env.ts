import { vi } from "vitest";
import { type Env } from "../env.js";

// Single source of truth for env mock values across ALL test files.
// Vitest picks this up automatically when vi.mock("...config/env.js")
// is called without a factory function.

export const env: Env = {
  NODE_ENV: "test",
  API_LOG_LEVEL: "silent",
  API_PORT: 8001,
  WEB_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://taskflow:changeme@localhost:5432/taskflow_test",
  NEXTAUTH_SECRET: "test-secret-value-at-least-16-chars2",
};

// vi.fn() so individual tests can override with .mockReturnValue(true)
export const isProduction = vi.fn((): boolean => false);
export const isDevelopment = vi.fn((): boolean => false);
export const isTest = vi.fn((): boolean => true);

// envSchema is only used in env.test.ts (imports the real module directly)
export const envSchema = {};
