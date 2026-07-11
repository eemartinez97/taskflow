"use client";

import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { type AppRouter } from "@taskflow/api/trpc";
import { type JSX, useState } from "react";
import superjson from "superjson";

import { isBrowser, isServer } from "../utils/runtime";
import { getQueryClient } from "./query-client";
import { publicEnv } from "../env.client";

/**
 * tRPC React instance typed against AppRouter.
 * Import `api` in Client Components:
 *   const { data } = api.tasks.list.useQuery({ ... });
 */
export const api = createTRPCReact<AppRouter>();

/** Browser: relative URL. Server: absolute URL for SSR/RSC. */
export function getBaseUrl(): string {
  if (isBrowser()) return "";
  return publicEnv.NEXT_PUBLIC_WEB_URL;
}

/**
 * Returns headers to forward with each tRPC request.
 * Browser: forwards cookies so the API context can validate the NextAuth session.
 * Server: returns {} - no document.cookie in Node/Edge context.
 * Exported for unit testing
 */
export function getTRPCHeaders(): Record<string, string> {
  if (isServer()) return {};
  return { cookie: document.cookie };
}

/** Mounts tRPC + TanStack Query providers. Place once in app/providers.tsx */
export function TRPCProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [queryClient] = useState(() => getQueryClient());

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers: getTRPCHeaders,
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
