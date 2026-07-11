import { io, type Socket } from "socket.io-client";

import type { ClientToServerEvents, ServerToClientEvents } from "@taskflow/shared";

import { isServer } from "@/lib/utils/runtime";
import { publicEnv } from "../env.client";

/** Typed Socket alias - used everywhere in the web app */
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Creates a new typed Socket.IO connection for a specific project room.
 *
 * Returns `null` on the server (SSR / RSC) - sockets are browser-only.
 *
 * Design:
 * - Factory (not singleton): each call to `useSocket` inside a mounted
 *   component creates its own connection, destroyed on unmount.
 * - `projectId` is sent in the handshake query so the server can
 *   immediately join the right room before the first event.
 * - `withCredentials: true` forwards the NextAuth session cookie so
 *   the server middleware can validate the caller.
 * - `autoConnect: false` lets the hook call `.connect()` explicitly,
 *   making connection timing testable.
 */
export function createSocket(projectId: string): AppSocket | null {
  if (isServer()) return null;

  return io(publicEnv.NEXT_PUBLIC_SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
    query: { projectId },
    transports: ["websocket", "polling"],
  });
}
