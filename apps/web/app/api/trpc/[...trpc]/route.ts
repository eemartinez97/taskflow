import "server-only";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createAppRouter } from "@taskflow/api/trpc";

import { createWebTRPCContext } from "@/lib/trpc/context";
import { noOpIo } from "@/lib/trpc/no-op-io";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

const appRouter = createAppRouter(noOpIo);

/** Development-only error logger. Only included in the dev bundle (tree-shaking). */
function devErrorHandler(opts: { path: string | undefined; error: Error; type: string }): void {
  logger.error({ path: opts.path, err: opts.error }, "tRPC error");
}

const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createWebTRPCContext({ headers: req.headers }),
    ...(serverEnv.NODE_ENV === "development" && { onError: devErrorHandler }),
  });

export { handler as GET, handler as POST };
