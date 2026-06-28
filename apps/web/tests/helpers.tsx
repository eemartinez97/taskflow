import type { JSX } from "react";
import { render, type RenderResult } from "@testing-library/react";

/**
 * Minimal render wrapper for unit tests.
 *
 * Keeps test render calls DRY. Extend this as new global providers
 * are added (tRPC, ReactQuery, SessionProvider)
 *
 * Usage:
 *   const { getByRole } = renderWithProviders(<MyComponent />)
 */
export function renderWithProviders(ui: JSX.Element): RenderResult {
  return render(ui);
}

// -- Environment fixtures --

export const VALID_SERVER_ENV = {
  NODE_ENV: "test" as const,
  DATABASE_URL: "postgresql://taskflow:changeme@localhost:5432/taskflow_test",
  NEXTAUTH_SECRET: "test-secret-value-at-least-16-chars",
  NEXTAUTH_URL: "http://localhost:3000",
};

export const VALID_PUBLIC_ENV = {
  NEXT_PUBLIC_SOCKET_URL: "http://localhost:8000",
};

export const VALID_FULL_ENV = {
  ...VALID_SERVER_ENV,
  ...VALID_PUBLIC_ENV,
};
