/**
 * Selective mock for `@tanstack/react-query`.
 * Tests that need real QueryClient behaviour (query-client.test.ts) must NOT activate this mock.
 */
import type { JSX } from "react";
import { vi } from "vitest";

export const QueryClientProvider = vi.fn(
  ({ children }: { children: React.ReactNode }): JSX.Element => children as unknown as JSX.Element,
);

export const HydrationBoundary = vi.fn(
  ({ children }: { children?: React.ReactNode }): JSX.Element =>
    (children ?? null) as unknown as JSX.Element,
);

export const dehydrate = vi.fn(() => ({}));

export const useQueryClient = vi.fn(() => ({
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  getQueryData: vi.fn(),
}));
