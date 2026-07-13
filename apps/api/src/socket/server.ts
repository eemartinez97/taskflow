import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";

import type { AppSocket, AppServer } from "./presence";
import { createPresenceHelpers, registerPresenceHandlers, resolveColor } from "./presence";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { getSessionUser } from "../utils/auth";
import { appCollectors } from "../metrics";

/**
 * Extracted for two reasons:
 * 1. io.use() signature is (socket, next) => void - async is not assignable.
 * 2. Named function is independently testable and improves stack traces
 */
export async function authenticateSocket(
  socket: AppSocket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    // Verify session statelessly from the handshake cookie
    const session = await getSessionUser(socket.handshake.headers.cookie);

    if (!session) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    // Resolve color once at handshake - stored in socket.data for all
    // subsequent presence events so it's never recomputed per-event
    socket.data = {
      userId: session.id,
      userEmail: session.email,
      userName: session.name, // Name is now extracted directly from the JWT
      color: resolveColor(session.id),
    };

    next();
  } catch (err) {
    logger.error({ err }, "Socket auth error");
    next(new Error("UNAUTHORIZED"));
  }
}

/**
 * Initialises the Socket.IO server and attaches it to the HTTP server.
 *
 * - No `io.set(...)` - options passed to the Server constructor.
 * - `Namespace.socket` (ES6 Map) used in getConnectedCount, not Namespace.connected.
 * - `Socket.rooms` is a Set - iterated with for..of in registerPresenceHandlers.
 *
 * Auth strategy
 * - Handshake middleware extracts the NextAuth v4 session cookie.
 * - Delegates validation to @auth/core stateless JWT verification.
 * - Valid session -> attaches userId, email, name, color to socket.data.
 * - Invalid / expired -> rejects with "UNAUTHORIZED"
 */
export function createSocketServer(httpServer: HttpServer): AppServer {
  const io: AppServer = new Server(httpServer, {
    cors: {
      origin: env.WEB_ORIGIN,
      credentials: true,
    },
    connectionStateRecovery: {},
    // No io.set(...) - removed in Socket.IO 4
  });

  // Handshake auth middleware
  io.use((socket, next) => {
    void authenticateSocket(socket, next);
  });

  // Connection handler
  io.on("connection", (socket) => {
    logger.debug({ userId: socket.data.userId, socketId: socket.id }, "Socket connected");

    // increment gauge when client connects
    appCollectors.socketConnectedClients.inc();

    // Built join/leave helpers bound to this socket
    const { joinProjectRoom } = createPresenceHelpers(io, socket);

    // Join the project helpers bound to this socket
    const { projectId } = socket.handshake.query;
    if (typeof projectId === "string" && projectId.length > 0) {
      joinProjectRoom(projectId);
    }

    // Register ongoing event handlers (typing, cursor, disconnecting)
    registerPresenceHandlers(io, socket);

    // Decrement gauge when client disconnects
    socket.on("disconnect", () => {
      appCollectors.socketConnectedClients.dec();
      logger.debug({ userId: socket.data.userId, socketId: socket.id }, "Socket disconnected");
    });
  });

  logger.info("Socket.IO server initialized");

  return io;
}

/**
 * Returns the count of currently connected sockets on the default namespace.
 * Uses Namespace.sockets (ES6 Map).size - NOT the removed Namespace.connected
 */
export function getConnectedCount(io: AppServer): number {
  return io.of("/").sockets.size;
}
