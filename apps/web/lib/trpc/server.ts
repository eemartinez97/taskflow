import "server-only";
import { createAppRouter, createCallerFactory, type TRPCContext } from "@taskflow/api/trpc";
import { cache } from "react";
import { headers } from "next/headers";

import { createWebTRPCContext } from "./context";
import { noOpIo } from "./no-op-io";

/**
 * Server-side tRPC caller for React Server Components.
 *
 * `noOpIo` is CORRECT here (and only here): RSCs run queries exclusively.
 * Every mutation goes from the browser straight to apps/api (see
 * lib/trpc/client.tsx), which owns the real Socket.IO server.
 *
 */
const webAppRouter = createAppRouter(noOpIo);
const createCaller = createCallerFactory(webAppRouter);

/** Per-request context - memoized with React cache() to avoid multiple DB/session round-trips. */
const getServerContext = cache(async (): Promise<TRPCContext> => {
  const requestHeaders = await headers();
  return createWebTRPCContext({ headers: requestHeaders });
});

/**
 * Usage:
 *   const trpc = await getServerTRPC();
 *   const projects = await trpc.projects.list({ orgId });
 */
export const getServerTRPC = cache(async () => {
  const ctx = await getServerContext();
  return createCaller(ctx);
});
