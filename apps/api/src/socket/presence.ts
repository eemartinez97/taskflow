import type { Server, Socket } from "socket.io";
import type { InterServerEvents, SocketData } from "./events.js";
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  presenceCursorSchema,
  presenceUserSchema,
  SOCKET_EVENTS,
  SOCKET_ROOM_PREFIX,
} from "@taskflow/shared";
import { logger } from "../config/logger.js";
import { shouldDropPresencePacket } from "./rate-limit.js";

// Typed aliases

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// Color resolution

/**
 * Deterministically assigns a color from a fixed palette to a user
 * based on their userId — consistent across reconnections.
 */
const PRESENCE_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
] as const;

/**
 * Deterministically assigns a color from a fixed palette based on userId.
 * Same userId always maps to the same color - consistent across reconnections.
 * Exported for unit testing
 */
export function resolveColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  // PRESENCE_COLORS.length is a compile-time constant (8) - non-null assertion is safe.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length]!;
}

// Internal helpers

/**
 * Returns all project the socket is currently in.
 * Socket.IO 4: Socket.rooms is a Set - iterate with for...of, not for...in
 */
export function getProjectRooms(socket: AppSocket): string[] {
  return [...socket.rooms].filter((room) => room.startsWith(SOCKET_ROOM_PREFIX));
}

/**
 * Registers ongoing presence event handlers on an authenticated socket.
 * Called once per connection from createSocketServer's "connection" handler.
 *
 * Handlers:
 * - task:typing - relay with userId attached
 * - presence:cursor - validate payload, apply per-room rate limit, relay
 * - disconnecting - broadcast presence:leave for every project room
 *
 * NOTE: `disconnecting` (not `disconnect`) is required to access socket.rooms.
 * In socket.IO 4, rooms are cleared BEFORE the `disconnect` event fires.
 * `disconnecting` fires first - rooms are still populated at the point.
 */
export function registerPresenceHandlers(_io: AppServer, socket: AppSocket): void {
  const { userId } = socket.data;

  /**
   * task:typing — relay to other members in the same project room.
   * Client throttles at 50ms; no server-side rate limit needed here.
   */
  socket.on(SOCKET_EVENTS.TASK_TYPING, (payload) => {
    for (const room of getProjectRooms(socket)) {
      socket.broadcast.to(room).emit(SOCKET_EVENTS.TASK_TYPING, {
        taskId: payload.taskId,
        userId,
      });
    }
  });

  /**
   * presence:cursor - validate payload, apply per-room rate limit, then
   * re-broadcast to other members. Rate limit: 30 packets/s per project room.
   * Only presence packets are dropped - task events bypass this gate entirely
   */
  socket.on(SOCKET_EVENTS.PRESENCE_CURSOR, (payload) => {
    const parsed = presenceCursorSchema.safeParse(payload);
    if (!parsed.success) return; // silently drop malformed packets

    for (const room of getProjectRooms(socket)) {
      if (shouldDropPresencePacket(room)) {
        logger.debug({ room, userId }, "Presence packet dropped (rate limit)");
        continue;
      }
      socket.broadcast.to(room).emit(SOCKET_EVENTS.PRESENCE_CURSOR, parsed.data);
    }
  });

  /**
   * disconnect — broadcast presence:leave for every project room.
   * getProjectRooms() captures the rooms BEFORE Socket.IO clears them
   * on disconnect, so the broadcast reaches the correct audience.
   *
   * Socket.IO 4: Socket.rooms is a Set — use for...of, not for...in.
   */
  socket.on("disconnecting", () => {
    for (const room of getProjectRooms(socket)) {
      socket.broadcast.to(room).emit(SOCKET_EVENTS.PRESENCE_LEAVE, { userId });
      logger.debug({ userId, room }, "Broadcast presence:leave on disconnect");
    }
  });
}

// Room join / leave helpers

/**
 * Returns join/leave helpers bound to a specific authenticated socket.
 * Called by server.ts after the auth handshake passes.
 *
 * Keeping this separate from registerPresenceHandlers means server.ts controls
 * WHEN the initial join happens (after auth) without mixing it into the
 * event-listener registration logic.
 */
export function createPresenceHelpers(
  _io: AppServer,
  socket: AppSocket,
): {
  joinProjectRoom: (projectId: string) => void;
  leaveProjectRoom: (projectId: string) => void;
} {
  const { userId, userName, color } = socket.data;

  function joinProjectRoom(projectId: string): void {
    const room = `${SOCKET_ROOM_PREFIX}${projectId}`;
    void socket.join(room);

    // Validate the presence payload before broadcasting - reuses the Zod schema
    // from @taskflow/shared so the shape is always consistent with the client type
    const presencePayload = presenceUserSchema.safeParse({ userId, name: userName, color });
    if (!presencePayload.success) return;

    socket.broadcast.to(room).emit(SOCKET_EVENTS.PRESENCE_JOIN, presencePayload.data);
    logger.debug({ userId, room, socketId: socket.id }, "Socket joined project room");
  }

  function leaveProjectRoom(projectId: string): void {
    const room = `${SOCKET_ROOM_PREFIX}${projectId}`;
    socket.broadcast.to(room).emit(SOCKET_EVENTS.PRESENCE_LEAVE, { userId });
    void socket.leave(room);
    logger.debug({ userId, room, socketId: socket.id }, "Socket left project room");
  }

  return { joinProjectRoom, leaveProjectRoom };
}
