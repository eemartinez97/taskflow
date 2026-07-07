import type { Server } from "socket.io";

/**
 * No-op Socket.IO server for the Next.js serverless context.
 * Real-time events originate from apps/api; mutations run correctly here
 * without emitting WS events.
 * `as unknown as Server` is intentional at this validated architectural boundary.
 */
export const noOpIo = {
  to: (_room: string) => ({
    emit: (_event: string, _payload: unknown): boolean => false,
  }),
} as unknown as Server;
