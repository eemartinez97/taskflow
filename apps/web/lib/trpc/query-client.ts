import { MutationCache, QueryClient } from "@tanstack/react-query";

import { isServer } from "@/lib/utils/runtime";
import { toast } from "@/lib/toast/store";

/**
 * Typed mutation meta: `meta: { skipErrorToast: true }` on any useMutation
 * opts out of the global error toast (for forms that already render the
 * error inline with <Alert>).
 */
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { skipErrorToast?: boolean };
  }
}

/**
 * Creates a QueryClient with SSR-safe defaults.
 *
 * Global mutation error handling: EVERY failed mutation in the app surfaces
 * an error toast from this single place - no per-callsite onError needed.
 * Mutations that show inline alerts opt out via meta.skipErrorToast.
 *
 * TanStack Query v5: `cacheTime` renamed to `gcTime`.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.skipErrorToast) return;
        toast.error(error.message || "Something went wrong. Please try again.");
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** Browser singleton; server always gets a fresh client (no shared state across requests) */
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
