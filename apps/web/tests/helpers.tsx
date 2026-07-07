import { render, type RenderResult } from "@testing-library/react";
import { type QueryClient } from "@tanstack/react-query";
import { type PrismaClient } from "@taskflow/database";
import { type SessionUser } from "@taskflow/shared";
import { type MockInstance, vi } from "vitest";
import { useRouter } from "next/navigation";
import { type Session } from "next-auth";
import { type JSX } from "react";

import { type WebTRPCContext } from "@/lib/trpc/context";
import { mockDb } from "@/tests/mocks/taskflow-database";
import { type Logger } from "@/lib/logger.js";

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
  NEXT_PUBLIC_WEB_URL: "http://localhost:3000",
};

export const VALID_FULL_ENV = {
  ...VALID_SERVER_ENV,
  ...VALID_PUBLIC_ENV,
};

// -- Auth fixtures (shared between lib/auth and page tests) --

export const VALID_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
export const HASHED_PASSWORD = "$2b$12$hashed";
export const HASH_PASSWORD = "$2b$12$hash";

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

/** ServerSessionUser fixture - returned by getServerSessionFromHeader */
export const mockServerSessionUser: SessionUser = {
  ...mockAuthorizedUser,
};

/** NextAuth v4 Session fixture - used by mocks that return a full Session */
export const mockSession: Session = {
  expires: new Date(Date.now() + 1_000 * 60 * 60).toISOString(),
  user: {
    ...mockAuthorizedUser,
  },
};

// -- Prisma session row fixture --

interface SessionWithUser {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
  user: { id: string; email: string; name: string | null; image: string | null };
}

/**
 * Builds a valid Prisma session row for mocking session lookups.
 *
 */
export function makeSessionRow(
  token: string,
  overrides: Partial<SessionWithUser> = {},
): SessionWithUser {
  return {
    id: "session-id-1",
    sessionToken: token,
    userId: VALID_USER_ID,
    expires: new Date(Date.now() + 1_000 * 60 * 60), // +1 hour
    user: { ...mockAuthorizedUser },
    ...overrides,
  };
}

// -- Headers helper

/**
 * Minimal Headers mock for createWebTRPCContext tests.
 * Avoids importing the global Headers object which may not be available
 * in all jsdom configurations.
 */
export function makeHeaders(entries: Record<string, string> = {}): Headers {
  const h = new Headers();
  for (const [key, value] of Object.entries(entries)) {
    h.set(key, value);
  }
  return h;
}

/**
 * Builds a Headers instance with a NextAuth v4 session cookie.
 * Convenience wrapper around makeHeaders for the most common test case.
 */
export function makeSessionHeaders(token: string, secure = false): Headers {
  const cookieName = secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
  return makeHeaders({ cookie: `${cookieName}=${token}` });
}

// -- tRPC context fixture --

/** Pre-cast mockDb as PrismaClient - avoids repeating the cast in every test */
export const db = mockDb as unknown as PrismaClient;

/**
 * Creates an isolated WebTRPCContext for unit tests.
 * Reused by context.test.ts and any future procedure test in apps/web.
 */
export function makeWebTRPCContext(overrides: Partial<WebTRPCContext> = {}): WebTRPCContext {
  return {
    db: {} as PrismaClient,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger,
    user: { ...mockAuthorizedUser },
    ...overrides,
  };
}

// -- Router mock --

export interface RouterMock {
  pushMock: MockInstance<(href: string) => void>;
  replaceMock: MockInstance<(href: string) => void>;
  router: ReturnType<typeof useRouter>;
}

export function makeRouterMock(): RouterMock {
  const pushMock = vi.fn<(href: string) => void>();
  const replaceMock = vi.fn<(href: string) => void>();

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

// -- Fetch spy helpers --

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

export type ShouldDehydrateFn = (query: { state: { status: string } }) => boolean;

export function extractShouldDehydrate(client: QueryClient): ShouldDehydrateFn {
  const fn = client.getDefaultOptions().dehydrate?.shouldDehydrateQuery;
  if (!fn) throw new Error("shouldDehydrateQuery is not configured on this QueryClient");
  // Post-QueryClient-boundary cast: we test only the boolean decision, not the full Query shape.
  return fn as unknown as ShouldDehydrateFn;
}
