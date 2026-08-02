import type { createAppRouter } from "@taskflow/api/trpc";

/** Exact Socket.IO server type expected by createAppRouter (AppServer). */
type AppServerParam = Parameters<typeof createAppRouter>[0];

/**
 * No-op Socket.IO server for the Next.js serverless context.
 * Real-time events originate from apps/api; mutations run correctly here
 * without emitting WS events.
 * The cast is intentional at this validated architectural boundary: RSCs
 * only run queries, so no event is ever emitted through this object.
 */
export const noOpIo = {
  to: (_room: string) => ({
    emit: (_event: string, _payload: unknown): boolean => false,
  }),
} as unknown as AppServerParam;
