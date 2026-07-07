import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

import { isServer } from "../utils/runtime";

/**
 * Creates a QueryClient with SSR-safe defaults and superjson serialization.
 *
 * - `staleTime`: avoids immediate client refetch after SSR.
 * - `dehydrate`/`hydrate`: superjson handles Dates, BigInt, etc. across the wire.
 * - `shouldDehydrateQuery` extended to include pending queries so prefetched
 *   queries hydrate fully even when still loading.
 *
 * TanStack Query v5: `cacheTime` renamed to `gcTime`
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
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
