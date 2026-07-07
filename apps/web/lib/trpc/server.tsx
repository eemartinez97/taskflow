import { createAppRouter, createCallerFactory } from "@taskflow/api/trpc";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { type TRPCContext } from "@taskflow/api/trpc";
import { type JSX, cache } from "react";
import { headers } from "next/headers";

import { getQueryClient as _makeQueryClient } from "./query-client";
import { createWebTRPCContext } from "./context";
import { noOpIo } from "./no-op-io";

const webAppRouter = createAppRouter(noOpIo);
const createCaller = createCallerFactory(webAppRouter);

/** Per-request context - memoized with React cache() to avoid multiple DB/session round-trips. */
const getServerContext = cache(async (): Promise<TRPCContext> => {
  const requestHeaders = await headers();
  return createWebTRPCContext({ headers: requestHeaders });
});

/** Per-request QueryClient shared between getServerTRPC() and HydrationBoundary. */
export const getQueryClient = cache(_makeQueryClient);

/**
 * Server-side tRPC caller for React Server Component.
 *
 * Usage:
 *   const trpc = await getServerTRPC();
 *   void queryClient.prefetchQuery(trpc.projects.list.queryOptions({ orgId }))
 */
export const getServerTRPC = cache(async () => {
  const ctx = await getServerContext();
  return createCaller(ctx);
});

/** Dehydrates the current request's QueryClient into a HydrationBoundary */
export function TRPCHydrationBoundary({ children }: { children: React.ReactNode }): JSX.Element {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}
