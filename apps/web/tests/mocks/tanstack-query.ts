/**
 * Mock for `@tanstack/react-query`'s standalone hooks - `useIsFetching()` /
 * `useIsMutating()`, used by `useGlobalLoading` (lib/hooks/use-global-loading.ts).
 * Every other tRPC-driven query/mutation in this codebase goes through the
 * mocked `api` object (@/lib/trpc/client) instead, never touching
 * react-query directly - these two are the only place raw react-query hooks
 * are called, since tRPC's React integration doesn't itself re-expose
 * global fetching/mutating counts.
 *
 * Active globally (tests/setup/unit.ts) like the other cross-cutting mocks.
 *
 * Override per test:
 *   vi.mocked(useIsMutating).mockReturnValue(1)
 */

import { vi } from "vitest";
import type {
  useIsFetching as useIsFetchingType,
  useIsMutating as useIsMutatingType,
} from "@tanstack/react-query";

export const useIsFetching = vi.fn<typeof useIsFetchingType>(() => 0);
export const useIsMutating = vi.fn<typeof useIsMutatingType>(() => 0);
