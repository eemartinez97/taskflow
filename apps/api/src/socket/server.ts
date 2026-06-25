import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { prisma } from "@taskflow/database";

import type { AppSocket, AppServer } from "./presence.js";
import { createPresenceHelpers, registerPresenceHandlers, resolveColor } from "./presence.js";
import { env } from "../config/env.js";
import { parseCookieToken } from "../utils/cookies.js";
import { validateSessionToken } from "../utils/session.js";
import { logger } from "../config/logger.js";

/**
 * Extracted for two reasons:
 * 1. io.use() signature is (socket, next) => void - async is not assignable.
 * 2. Named function is independently testable and improves stack traces
 */
export async function authenticateSocket(
  socket: AppSocket,
  next: (err?: Error) => void,
): Promise<void> {
  const rawCookies = socket.handshake.headers.cookie ?? "";
  const token = parseCookieToken(rawCookies);

  if (!token) {
    next(new Error("UNAUTHORIZED"));
    return;
  }

  try {
    const session = await validateSessionToken(prisma, token);

    if (!session) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    // Resolve color once at handshake - stored in socket.data for all
    // subsequent presence events so it's never recomputed per-event
    socket.data = {
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      color: resolveColor(session.userId),
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
 * - Delegates validation to validateSessionToken (shared with Express middleware).
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

    // Built join/leave helpers bound to this socket
    const { joinProjectRoom } = createPresenceHelpers(io, socket);

    // Join the project helpers bound to this socket
    const { projectId } = socket.handshake.query;
    if (typeof projectId === "string" && projectId.length > 0) {
      joinProjectRoom(projectId);
    }

    // Register ongoing event handlers (typing, cursor, disconnecting)
    registerPresenceHandlers(io, socket);
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
