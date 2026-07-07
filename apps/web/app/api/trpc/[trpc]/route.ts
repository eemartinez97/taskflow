import "server-only";

import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createWebTRPCContext } from "@/lib/trpc/context";
import { noOpIo } from "@/lib/trpc/no-op-io";
import { createAppRouter } from "@taskflow/api/trpc";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

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
