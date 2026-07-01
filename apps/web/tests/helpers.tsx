import type { JSX } from "react";
import { render, type RenderResult } from "@testing-library/react";

import { type PrismaClient } from "@taskflow/database";
import { mockDb } from "@/tests/mocks/database";
import { type MockInstance, vi } from "vitest";
import { useRouter } from "next/navigation";

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

// -- Auth fixtures (shared between lib/auth and page tests) --

export const VALID_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
export const HASHED_PASSWORD = "$2b$12$hashed";
export const HASH_PASSWORD = "$2b$12$hash";

export const db = mockDb as unknown as PrismaClient;

/** Full User row as returned by Prisma (includes hashed password) */
export const mockDbUser = {
  id: VALID_USER_ID,
  email: "alice@taskflow.dev",
  name: "Alice",
  image: null,
  password: "hashed:correct-password",
};

/** User returned by authorizeCredentials (no password field) */
export const mockAuthorizedUser = {
  id: VALID_USER_ID,
  email: "alice@taskflow.dev",
  name: "Alice",
  image: null,
};

/** Minimal valid login credential payload */
export const validLoginCredentials = {
  email: "alice@taskflow.dev",
  password: "correct-password",
};

/** Minimal valid registration payload */
export const validRegisterPayload = {
  name: "Alice",
  email: "alice@taskflow.dev",
  password: "secure-password-123",
  confirmPassword: "secure-password-123",
};

// -- Router mock --

export interface RouterMock {
  pushMock: MockInstance<(href: string, options?: Record<string, unknown>) => void>;
  replaceMock: MockInstance<(href: string, options?: Record<string, unknown>) => void>;
  router: ReturnType<typeof useRouter>;
}

export function makeRouterMock(): RouterMock {
  const pushMock = vi.fn<(href: string, options?: Record<string, unknown>) => void>();
  const replaceMock = vi.fn<(href: string, options?: Record<string, unknown>) => void>();

  const router = {
    push: pushMock,
    replace: replaceMock,
    back: vi.fn<() => void>,
    forward: vi.fn<() => void>,
    refresh: vi.fn<() => void>,
    prefetch: vi.fn<() => void>,
  } as unknown as ReturnType<typeof useRouter>;

  return { pushMock, replaceMock, router };
}

/**
 * Configures vi.mocked(useRouter) and returns the mock for assertions.
 * Requires: vi.mock("next/navigation", ...) at the top of the test file.
 */
export function setupRouterMock(): RouterMock {
  const mock = makeRouterMock();
  vi.mocked(useRouter).mockReturnValue(mock.router);
  return mock;
}

// -- Fetch spy --

export type FetchSpy = MockInstance<typeof fetch>;

/**
 * Stubs globalThis.fetch with a properly-typed vi.fn() spy.
 * Pair with teardownFetchSpy() in afterEach.
 */
export function setupFetchSpy(defaultResponse?: Response): FetchSpy {
  const spy = vi.fn<typeof fetch>();
  if (defaultResponse) spy.mockResolvedValue(defaultResponse);
  vi.stubGlobal("fetch", spy);
  return spy;
}

export function teardownFetchSpy(): void {
  vi.unstubAllGlobals();
}

/**
 * Builds a typed Response with a JSON body and the given status code.
 */
export function mockFetchResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// -- Route Handler request builders --

/**
 * Builds a POST Request with a JSON body for Route Handler unit tests.
 */
export function makeApiRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Builds a POST Request with a new string body.
 * Use to test malformed JSON handling in Route Handlers.
 */
export function makeRawApiRequest(path: string, rawBody: string): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

/**
 * Builds a NextRequest-compatible mock where `.json()` rejects with a SyntaxError.
 *
 * WHY not `new Request(..., { body: "bad-json" })`:
 * In jsdom/Node test environments, `Request.json()` may silently resolve to
 * `undefined` instead of throwing for malformed input. Mocking `.json()` directly
 * is the only reliable way to exercise the `catch` branch in Route Handlers.
 */
export function makeJsonThrowRequest(path: string): Request {
  return {
    json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
    url: `http://localhost${path}`,
    method: "POST",
  } as unknown as Request;
}
