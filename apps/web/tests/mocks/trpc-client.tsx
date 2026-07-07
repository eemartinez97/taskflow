/**
 * Mock for `@/lib/trpc/client` - replaces the real tRPC React instance
 * with controllable vi.fn() spies for unit tests in pages/components
 * that call api.*.useQuery() / api.*.useMutation().
 *
 * Activate per test file:
 *   vi.mock("@/lib/trpc/client", () => import("@/mocks/trpc-client.js"));
 */
import { vi } from "vitest";
import type { JSX } from "react";
import type { MockInstance } from "vitest";

// -- Procedure mock factories --

export interface MockQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: MockInstance;
}

export interface MockMutationResult<T> {
  mutate: MockInstance;
  mutateAsync: MockInstance;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: T | undefined;
}

/** Creates a mock useQuery result. Override per test with vi.mocked(). */
export function makeMockQueryResult<T>(
  data?: T,
  overrides: Partial<MockQueryResult<T>> = {},
): MockQueryResult<T> {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn(), ...overrides };
}

/** Creates a mock useMutation result, Override per test ith vi.mocked(). */
export function makeMockMutationResult<T>(
  overrides: Partial<MockMutationResult<T>> = {},
): MockMutationResult<T> {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides,
  };
}

// -- api mock object --

export const api = {
  Provider: vi.fn(
    ({ children }: { children: React.ReactNode }): JSX.Element =>
      children as unknown as JSX.Element,
  ),
  createClient: vi.fn(() => ({})),
  useUtils: vi.fn(() => ({
    invalidate: vi.fn(),
    tasks: { list: { setData: vi.fn(), invalidate: vi.fn() } },
    projects: { list: { setData: vi.fn(), invalidate: vi.fn() } },
  })),
};

// -- TRPCProvider mock --

export function TRPCProvider({ children }: { children: React.ReactNode }): JSX.Element {
  return children as unknown as JSX.Element;
}

// -- getBaseUrl export --

export const getBaseUrl = vi.fn((): string => "");
