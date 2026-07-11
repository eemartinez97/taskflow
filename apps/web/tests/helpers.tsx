import { render, type RenderResult } from "@testing-library/react";
import { type QueryClient } from "@tanstack/react-query";
import { type MockInstance, vi } from "vitest";
import { useRouter } from "next/navigation";
import { type JSX } from "react";

import type { Column, Task, Board, OrgWithMembership, Project } from "@taskflow/database";
import type { SocketTask, SessionUser } from "@taskflow/shared";
import { type PrismaClient } from "@taskflow/database";

import { resetHandlerStore, triggerSocketEvent } from "./mocks/socket-io-client";
import { type WebTRPCContext } from "@/lib/trpc/context";
import { mockDb } from "@/tests/mocks/taskflow-database";
import type { TasksMap } from "@/hooks/use-board-dnd";
import { type Logger } from "@/lib/logger";

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

export { mockSession } from "@/tests/mocks/next-auth";

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

// -- Board / Kanban fixtures --

export const VALID_BOARD_ID = "b0000000-0000-4000-8000-000000000001";
export const VALID_COL_A_ID = "c0000000-0000-4000-8000-000000000001";
export const VALID_COL_B_ID = "c0000000-0000-4000-8000-000000000002";
export const VALID_TASK_1_ID = "t0000000-0000-4000-8000-000000000001";
export const VALID_TASK_2_ID = "t0000000-0000-4000-8000-000000000002";
export const VALID_PROJECT_ID = "p0000000-0000-4000-8000-000000000001";
export const VALID_ORG_ID = "o0000000-0000-4000-8000-000000000001";

/** Creates a minimal Column fixture with optional overrides */
export function makeColumn(overrides: Partial<Column> = {}): Column {
  const id = overrides.id ?? VALID_COL_A_ID;
  return {
    id,
    boardId: VALID_BOARD_ID,
    name: "To Do",
    position: 1000,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Creates a minimal Task fixture with optional overrides */
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: VALID_TASK_1_ID,
    columnId: VALID_COL_A_ID,
    title: "Fix login bug",
    description: null,
    assigneeId: null,
    priority: "NONE",
    status: "TODO",
    position: 1000,
    dueDate: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Creates a minimal Board fixture with columns */
export function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: VALID_BOARD_ID,
    projectId: VALID_PROJECT_ID,
    name: "Main Board",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Creates a default two-column TasksMap for board tests */
export function makeTasksMap(overrides: Partial<TasksMap> = {}): TasksMap {
  return {
    [VALID_COL_A_ID]: [makeTask()],
    [VALID_COL_B_ID]: [],
    ...overrides,
  };
}

/** Creates a minimal OrgWithMembership fixture */
export function makeOrg(overrides: Partial<OrgWithMembership> = {}): OrgWithMembership {
  return {
    id: VALID_ORG_ID,
    name: "Acme Corp",
    slug: "acme-corp",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    memberships: [
      {
        id: "m1",
        orgId: VALID_ORG_ID,
        userId: mockAuthorizedUser.id,
        role: "OWNER",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ],
    ...overrides,
  } as OrgWithMembership;
}

/** Creates a minimal Project fixture */
export function makeProject(
  overrides: Partial<{
    id: string;
    orgId: string;
    name: string;
    key: string;
    slug: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): Project {
  return {
    id: VALID_PROJECT_ID,
    orgId: VALID_ORG_ID,
    name: "Demo Project",
    key: "DEMO",
    slug: "demo-project",
    description: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// -- tRPC mock result factories --
// Used in component tests that call api.*.useQuery / api.*.useMutation

/**
 * Builds a typed mock useQuery result.
 *
 * Usage:
 *   vi.mocked(api.projects.list.useQuery).mockReturnValue(
 *     makeMockQueryResult([mockProject])
 *   );
 */
export interface MockQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: null;
  refetch: ReturnType<typeof vi.fn>;
}

export function makeMockQueryResult<T>(
  data?: T,
  overrides: Partial<MockQueryResult<T>> = {},
): MockQueryResult<T> {
  return {
    data,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

/**
 * Builds a typed mock useMutation result.
 *
 * Usage:
 *   vi.mocked(api.tasks.move.useMutation).mockReturnValue(
 *     makeMockMutationResult()
 *   );
 */
export interface MockMutationResult<T = unknown> {
  mutate: ReturnType<typeof vi.fn>;
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: T | undefined;
  reset: ReturnType<typeof vi.fn>;
}

export function makeMockMutationResult<T = unknown>(
  overrides: Partial<MockMutationResult<T>> = {},
): MockMutationResult<T> {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
    ...overrides,
  };
}

/** Type alias for the factory function accepted by `api.useQueries`.*/
export type UseQueriesFactory = (t: { tasks: { list: ReturnType<typeof vi.fn> } }) => unknown;

/** Type alias for the mock returned by makeUseQueriesMock. */
export type UseQueriesMock = ReturnType<
  typeof vi.fn<(factory: UseQueriesFactory) => { data: unknown[] | undefined }[]>
>;

// -- ServerTRPC mock factory --

export interface ServerTRPCMockOverrides {
  orgs?: { list?: ReturnType<typeof vi.fn> };
  projects?: {
    list?: ReturnType<typeof vi.fn>;
    get?: ReturnType<typeof vi.fn>;
  };
  boards?: { getByProject?: ReturnType<typeof vi.fn> };
  tasks?: { list?: ReturnType<typeof vi.fn> };
}

/**
 * Concrete return type — every field required and non-nullable.
 * Lets tests access `.projects.get` without optional chaining.
 */
export interface ServerTRPCMock {
  orgs: { list: ReturnType<typeof vi.fn> };
  projects: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
  boards: { getByProject: ReturnType<typeof vi.fn> };
  tasks: { list: ReturnType<typeof vi.fn> };
}

/**
 * Builds a typed mock object for `getServerTRPC()`.
 * Each resource method defaults to returning empty/null and can be
 * overridden per test via the `overrides` parameter.
 *
 * Usage:
 *   vi.mocked(getServerTRPC).mockResolvedValue(
 *     buildServerTRPCMock({
 *       orgs: { list: vi.fn().mockResolvedValue([mockOrg]) },
 *     }) as never,
 *   );
 */
export function buildServerTRPCMock(overrides: ServerTRPCMockOverrides = {}): ServerTRPCMock {
  return {
    orgs: {
      list: vi.fn().mockResolvedValue([]),
      ...overrides.orgs,
    },
    projects: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(makeProject()),
      ...overrides.projects,
    },
    boards: {
      getByProject: vi.fn().mockResolvedValue(null),
      ...overrides.boards,
    },
    tasks: {
      list: vi.fn().mockResolvedValue([]),
      ...overrides.tasks,
    },
  };
}

// -- mutation mock factory --

export interface MutationMockResult {
  /** The vi.fn() spy that is passed as `mutate` to the component. */
  mutateMock: ReturnType<typeof vi.fn>;
  /**
   * Triggers the captured `onSuccess` callback.
   * Call this after rendering the component that uses the mutation.
   */
  triggerSuccess: () => void;
  /**
   * Triggers the captured `onError` callback.
   * Call this to simulate a server-side mutation error.
   */
  triggerError: (err: { message: string }) => void;
}

/**
 * Sets up a `useMutation` mock that captures `onSuccess` and `onError`
 * callbacks so tests can trigger them programmatically.
 *
 * @param mutation - The tRPC mock resource that has a `useMutation` spy.
 */
export function setupMutationMock(mutation: {
  useMutation: ReturnType<typeof vi.fn>;
}): MutationMockResult {
  let capturedOnSuccess: (() => void) | undefined;
  let capturedOnError: ((err: { message: string }) => void) | undefined;

  const mutateMock = vi.fn();

  vi.mocked(mutation.useMutation).mockImplementation(
    (options?: { onSuccess?: () => void; onError?: (err: { message: string }) => void }) => {
      capturedOnSuccess = options?.onSuccess;
      capturedOnError = options?.onError;

      return {
        mutate: mutateMock,
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
        reset: vi.fn(),
      };
    },
  );

  return {
    mutateMock,
    triggerSuccess() {
      if (!capturedOnSuccess)
        throw new Error("onSuccess not captured — render the component first");
      capturedOnSuccess();
    },
    triggerError(err) {
      if (!capturedOnError) throw new Error("onError not captured — render the component first");
      capturedOnError(err);
    },
  };
}

// -- UseQueries mock factory --

/**
 * Builds a typed `api.useQueries` mock implementation.
 * Captures the factory callback call and returns `returnValues`.
 *
 * Usage:
 *   (api.useQueries as unknown as UseQueriesMock).mockImplementation(
 *     makeUseQueriesMock([{ data: [task1] }, { data: [] }])
 *   );
 */
export function makeUseQueriesMock(
  returnValues: { data: unknown[] | undefined }[],
): (factory: UseQueriesFactory) => { data: unknown[] | undefined }[] {
  return (factory: UseQueriesFactory) => {
    const builder = {
      tasks: {
        list: vi.fn(
          (_input: { orgId: string; columnId: string }, opts?: { initialData?: unknown[] }) => ({
            queryKey: ["tasks", "list"],
            queryFn: (): unknown[] => opts?.initialData ?? [],
            initialData: opts?.initialData,
          }),
        ),
      },
    };

    try {
      factory(builder);
    } catch {
      // Builder invocation may throw in some test scenarios — swallow intentionally
    }

    return returnValues;
  };
}

// -- Socket / realtime fixtures --

// Socket / realtime re-exports
export { triggerSocketEvent, resetHandlerStore };

/**
 * Converts a local Task fixture to SocketTask shape.
 * Keeps the Date objects as-is; in production these arrive as ISO strings
 * over the wire but the types use Date for schema correctness.
 */
export function toSocketTask(task: ReturnType<typeof makeTask>): SocketTask {
  return {
    id: task.id,
    columnId: task.columnId,
    title: task.title,
    description: task.description,
    assigneeId: task.assigneeId,
    priority: task.priority,
    status: task.status,
    position: task.position,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/**
 * Builds a tRPC utils mock with controllable `setData` and `getData` spies
 * backed by an in-memory cache.
 *
 * `setData` mutates the internal cache so `getData` can return the updated
 * value in tests that chain multiple events.
 */
export interface TRPCUtilsMock {
  tasks: {
    list: {
      setData: ReturnType<typeof vi.fn>;
      getData: ReturnType<typeof vi.fn>;
    };
  };
}

export function makeTRPCUtilsMock(initialCache: Record<string, SocketTask[]> = {}): TRPCUtilsMock {
  const cache: Record<string, SocketTask[]> = { ...initialCache };

  return {
    tasks: {
      list: {
        setData: vi.fn(
          (
            input: { orgId: string; columnId: string },
            updater: ((prev: SocketTask[] | undefined) => SocketTask[]) | SocketTask[],
          ) => {
            const prev = cache[input.columnId];
            cache[input.columnId] = typeof updater === "function" ? updater(prev) : updater;
          },
        ),
        getData: vi.fn(
          (input: { orgId: string; columnId: string }): SocketTask[] | undefined =>
            cache[input.columnId],
        ),
      },
    },
  };
}
