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

/** Mounts tRPC + TanStack Query providers. Place once in app/providers.tsx */
export function TRPCProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [queryClient] = useState(() => getQueryClient());

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${publicEnv.NEXT_PUBLIC_API_URL}/trpc`,
          transformer: superjson,
          fetch: (url, options) =>
            fetch(url, { ...options, credentials: "include", signal: options?.signal ?? null }),
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}
