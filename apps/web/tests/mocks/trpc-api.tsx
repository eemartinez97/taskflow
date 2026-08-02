/**
 * Mock for `@/lib/trpc/client` (the `api` export).
 * Every procedure is a vi.fn() spy with a sane default; override per test:
 *   vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([mockProject]));
 *
 * Activate per test file:
 *   vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));
 */
import type { JSX } from "react";
import { vi } from "vitest";

const defaultQuery = {
  data: undefined,
  isLoading: false,
  isPending: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
  error: null,
  refetch: vi.fn(),
};

const defaultMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: undefined,
  reset: vi.fn(),
};

function query() {
  return vi.fn(() => ({ ...defaultQuery }));
}
function mutation() {
  return vi.fn(() => ({ ...defaultMutation }));
}

const utilsInvalidate = () => ({
  invalidate: vi.fn(),
  setData: vi.fn(),
  getData: vi.fn(),
  cancel: vi.fn(),
});

export const api = {
  auth: {
    me: { useQuery: query() },
    updateProfile: { useMutation: mutation() },
    signOut: { useMutation: mutation() },
  },
  orgs: {
    list: { useQuery: query() },
    members: { useQuery: query() },
    create: { useMutation: mutation() },
    update: { useMutation: mutation() },
    delete: { useMutation: mutation() },
    invite: { useMutation: mutation() },
    removeMember: { useMutation: mutation() },
    updateMemberRole: { useMutation: mutation() },
  },
  projects: {
    list: { useQuery: query() },
    get: { useQuery: query() },
    create: { useMutation: mutation() },
    update: { useMutation: mutation() },
    delete: { useMutation: mutation() },
  },
  boards: {
    list: { useQuery: query() },
    get: { useQuery: query() },
    create: { useMutation: mutation() },
    update: { useMutation: mutation() },
    delete: { useMutation: mutation() },
    addColumn: { useMutation: mutation() },
    renameColumn: { useMutation: mutation() },
    deleteColumn: { useMutation: mutation() },
    reorderColumns: { useMutation: mutation() },
  },
  tasks: {
    list: { useQuery: query() },
    get: { useQuery: query() },
    myTasks: { useQuery: query() },
    labels: { useQuery: query() },
    labelsByProject: { useQuery: query() },
    create: { useMutation: mutation() },
    update: { useMutation: mutation() },
    move: { useMutation: mutation() },
    delete: { useMutation: mutation() },
    addLabel: { useMutation: mutation() },
    removeLabel: { useMutation: mutation() },
  },
  comments: {
    list: { useQuery: query() },
    create: { useMutation: mutation() },
    delete: { useMutation: mutation() },
  },
  labels: {
    list: { useQuery: query() },
    create: { useMutation: mutation() },
    delete: { useMutation: mutation() },
  },
  notifications: {
    list: { useQuery: query() },
    markRead: { useMutation: mutation() },
    markAllRead: { useMutation: mutation() },
    delete: { useMutation: mutation() },
  },
  useQueries: vi.fn(() => []),
  useUtils: vi.fn(() => ({
    invalidate: vi.fn(),
    orgs: { list: utilsInvalidate(), members: utilsInvalidate() },
    projects: { list: utilsInvalidate() },
    boards: { list: utilsInvalidate(), get: utilsInvalidate() },
    tasks: {
      list: utilsInvalidate(),
      get: utilsInvalidate(),
      myTasks: utilsInvalidate(),
      labels: utilsInvalidate(),
      labelsByProject: utilsInvalidate(),
    },
    comments: { list: utilsInvalidate() },
    labels: { list: utilsInvalidate() },
    notifications: { list: utilsInvalidate() },
  })),
  Provider: vi.fn(({ children }: { children: React.ReactNode }): JSX.Element => <>{children}</>),
  createClient: vi.fn(() => ({})),
};

export function TRPCProvider({ children }: { children: React.ReactNode }): JSX.Element {
  return <>{children}</>;
}
