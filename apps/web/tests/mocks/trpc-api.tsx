/**
 * Mock for the full `@/lib/trpc/client` tRPC instance (the `api` export).
 *
 * Each resource and method is a vi.fn() spy.
 * Individual tests override per-call behaviour:
 *   vi.mocked(api.projects.list.useQuery).mockReturnValue({
 *     data: [mockProject], isLoading: false, ...
 *   });
 *
 * Activate per test file:
 *   vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api.js"));
 */

import type { JSX } from "react";
import { vi } from "vitest";

interface MockQueryResult {
  data: unknown[] | undefined;
  isLoading: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: null;
  refetch: ReturnType<typeof vi.fn>;
}

// -- Default result shapes --
const defaultQuery: MockQueryResult = {
  data: [] as unknown[],
  isLoading: false,
  isPending: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

const defaultMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  error: null,
  data: undefined,
  reset: vi.fn(),
};

// -- Full api mock object --

export const api = {
  // --- auth ---
  auth: {
    me: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    signOut: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
  },

  // --- orgs ---
  orgs: {
    list: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    create: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    update: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    delete: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    invite: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    removeMember: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    members: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
  },

  // --- projects ---
  projects: {
    list: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    get: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    create: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    update: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    delete: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
  },

  // --- boards ---
  boards: {
    list: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    getByProject: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    create: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    update: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    addColumn: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    reorderColumns: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
  },

  // --- tasks ---
  tasks: {
    list: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    get: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    create: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    update: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    move: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    delete: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
  },

  // --- comments ---
  comments: {
    list: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    create: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    delete: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
  },

  // --- labels ---
  labels: {
    list: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    create: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    delete: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
  },

  // --- notifications ---
  notifications: {
    list: { useQuery: vi.fn(() => ({ ...defaultQuery })) },
    markRead: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    markAllRead: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
    delete: { useMutation: vi.fn(() => ({ ...defaultMutation })) },
  },

  // --- useQueries (batched column task fetching) ---
  useQueries: vi.fn(() => []),

  // --- useUtils (TanStack Query cache invalidation / optimistic updates) ---
  useUtils: vi.fn(() => ({
    invalidate: vi.fn(),
    projects: { list: { invalidate: vi.fn(), setData: vi.fn() } },
    tasks: {
      list: {
        invalidate: vi.fn(),
        setData: vi.fn(),
      },
    },
  })),

  // --- Provider + createClient (used by TRPCProvider component) ---
  Provider: vi.fn(
    ({ children }: { children: React.ReactNode }): JSX.Element =>
      children as unknown as JSX.Element,
  ),
  createClient: vi.fn(() => ({})),
};

// -- Named exports that mirror lib/trpc/client --

/** Returns "" in all test environments (same-origin relative URL). */
export const getBaseUrl = vi.fn((): string => "");

/** Returns empty headers in all test environments. */
export const getTRPCHeaders = vi.fn((): Record<string, string> => ({}));

/**
 * Passthrough TRPCProvider — renders children directly without any
 * QueryClient or tRPC initialization overhead.
 */
export function TRPCProvider({ children }: { children: React.ReactNode }): JSX.Element {
  return children as unknown as JSX.Element;
}
