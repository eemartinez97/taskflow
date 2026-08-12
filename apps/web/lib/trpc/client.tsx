"use client";

import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { type AppRouter } from "@taskflow/api/trpc";
import { type JSX, useState } from "react";
import superjson from "superjson";

import { getQueryClient } from "./query-client";
import { publicEnv } from "../env.client";

/**
 * tRPC React instance typed against AppRouter.
 * Import `api` in Client Components:
 *   const { data } = api.tasks.list.useQuery({ ... });
 */
export const api = createTRPCReact<AppRouter>();

/**
 * x-e2e-secret only set when NEXT_PUBLIC_E2E_TEST_SECRET is present (E2E
 * runs only, see env.ts) - lets apps/api's auth rate limiter bypass apply to
 * UI-driven register/reset traffic, not just the /api/test/* backdoor
 * routes. Extracted as a plain function (same pattern as http-server.ts's
 * buildInternalSecretHeaders) so both ternary branches are covered by direct
 * unit tests rather than by re-rendering <TRPCProvider> under different
 * mocked env states.
 */
export function buildE2EHeaders(): Record<string, string> | undefined {
  return publicEnv.NEXT_PUBLIC_E2E_TEST_SECRET
    ? { "x-e2e-secret": publicEnv.NEXT_PUBLIC_E2E_TEST_SECRET }
    : undefined;
}

/** Mounts tRPC + TanStack Query providers. Place once in app/providers.tsx */
export function TRPCProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [queryClient] = useState(() => getQueryClient());

  const [trpcClient] = useState(() => {
    const e2eHeaders = buildE2EHeaders();
    return api.createClient({
      links: [
        httpBatchLink({
          url: `${publicEnv.NEXT_PUBLIC_API_URL}/trpc`,
          transformer: superjson,
          ...(e2eHeaders ? { headers: e2eHeaders } : {}),
          fetch: (url, options) =>
            fetch(url, { ...options, credentials: "include", signal: options?.signal ?? null }),
        }),
      ],
    });
  });

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}
