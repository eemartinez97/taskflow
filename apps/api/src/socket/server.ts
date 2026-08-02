import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";

import {
  announceOfflineIfLast,
  announceOnlineIfFirst,
  buildOnlineSync,
  createPresenceHelpers,
  registerPresenceHandlers,
  resolveColor,
} from "./presence";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { getSessionUser } from "../utils/auth";
import { appCollectors } from "../metrics";
import {
  SOCKET_ORG_ROOM_PREFIX,
  SOCKET_ROOM_PREFIX,
  SOCKET_USER_ROOM_PREFIX,
} from "@taskflow/shared";
import type { AppServer, AppSocket } from "./events";
import { findUserOrgIds } from "./presence-repo";
import { prisma } from "@taskflow/database";

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

    // Set (not inc) from the authoritative namespace size: with
    // connectionStateRecovery a recovered session re-fires "connection"
    // without a matching "disconnect", which made inc/dec drift.
    appCollectors.socketConnectedClients.set(getConnectedCount(io));

    // Personal room for user-scoped pushes (notifications). Joined on every
    // connection regardless of project - the recipient may be anywhere.
    void socket.join(`${SOCKET_USER_ROOM_PREFIX}${socket.data.userId}`);

    // Global org presence: join the user's org rooms, announce online on the
    // first live socket, and push the current online roster to the joiner.
    // The disconnecting handler mirrors it (offline on the last socket).
    void (async () => {
      const orgIds = await findUserOrgIds(prisma, socket.data.userId);
      for (const orgId of orgIds) {
        void socket.join(`${SOCKET_ORG_ROOM_PREFIX}${orgId}`);
      }
      await announceOnlineIfFirst(io, socket, orgIds);
      await buildOnlineSync(io, socket, orgIds);

      socket.on("disconnecting", () => {
        void announceOfflineIfLast(io, socket, orgIds);
      });
    })();

    // Built join/leave helpers bound to this socket
    const { joinBoardRoom } = createPresenceHelpers(io, socket);

    const { projectId, boardId } = socket.handshake.query;

    // Silent join: needed so project-wide task/board mutation events
    // (TASK_*, BOARD_UPDATED, COMMENT_*) keep reaching this socket regardless
    // of which board is being viewed. No presence is tied to this room.
    if (typeof projectId === "string" && projectId.length > 0) {
      void socket.join(`${SOCKET_ROOM_PREFIX}${projectId}`);
    }

    // Board-scoped presence + live cursors + typing - isolated per board so
    // two users on DIFFERENT boards of the same project never see each
    // other's viewer avatars or pointers (previously both leaked at the
    // project-wide room).
    if (typeof boardId === "string" && boardId.length > 0) {
      void joinBoardRoom(boardId);
    }

    // Register ongoing event handlers (typing, cursor, disconnecting)
    registerPresenceHandlers(io, socket);

    // Decrement gauge when client disconnects
    socket.on("disconnect", () => {
      appCollectors.socketConnectedClients.set(getConnectedCount(io));
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
