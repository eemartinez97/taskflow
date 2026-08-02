import {
  presenceCursorSchema,
  presenceUserSchema,
  SOCKET_EVENTS,
  SOCKET_ORG_ROOM_PREFIX,
  SOCKET_BOARD_ROOM_PREFIX,
  SOCKET_USER_ROOM_PREFIX,
} from "@taskflow/shared";
import { logger } from "../config/logger";
import { shouldDropPresencePacket } from "./rate-limit";
import type { AppServer, AppSocket } from "./events";

// Color resolution

export const PRESENCE_COLORS = [
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
 * Board rooms the socket currently belongs to (usually zero or one).
 * Socket.IO 4: Socket.rooms is a Set - iterate with for...of, not for...in.
 */
function getBoardRooms(socket: AppSocket): string[] {
  return [...socket.rooms].filter((room) => room.startsWith(SOCKET_BOARD_ROOM_PREFIX));
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
export function registerPresenceHandlers(io: AppServer, socket: AppSocket): void {
  const { userId } = socket.data;

  /**
   * task:typing - relay to other members in the same project room.
   * Client throttles at 50ms; no server-side rate limit needed here.
   */
  socket.on(SOCKET_EVENTS.TASK_TYPING, (payload) => {
    for (const room of getBoardRooms(socket)) {
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

    for (const room of getBoardRooms(socket)) {
      if (shouldDropPresencePacket(room)) {
        logger.debug({ room, userId }, "Presence packet dropped (rate limit)");
        continue;
      }
      socket.broadcast.to(room).emit(SOCKET_EVENTS.PRESENCE_CURSOR, parsed.data);
    }
  });

  /**
   * presence:cursor:leave - relayed immediately (no rate limit, one-shot) so
   * peers remove this user's cursor as soon as the pointer exits the tracked
   * board area, instead of waiting for the 3s idle TTL on the client. Server
   * injects the real userId, same pattern as TASK_TYPING.
   */
  socket.on(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE, () => {
    for (const room of getBoardRooms(socket)) {
      socket.broadcast.to(room).emit(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE, { userId });
    }
  });

  /**
   * disconnect - broadcast presence:leave for every project room.
   * getProjectRooms() captures the rooms BEFORE Socket.IO clears them
   * on disconnect, so the broadcast reaches the correct audience.
   *
   * Socket.IO 4: Socket.rooms is a Set - use for...of, not for...in.
   */
  socket.on("disconnecting", () => {
    // Rooms must be read synchronously: Socket.IO clears them right after
    // this handler returns, before the async check below resolves.
    for (const room of getBoardRooms(socket)) {
      void emitLeaveIfLastSocket(io, socket, room);
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
  io: AppServer,
  socket: AppSocket,
): {
  joinBoardRoom: (boardId: string) => Promise<void>;
} {
  const { userId, userName, color } = socket.data;

  async function joinBoardRoom(boardId: string): Promise<void> {
    const room = `${SOCKET_BOARD_ROOM_PREFIX}${boardId}`;
    void socket.join(room);

    // Validate the presence payload before broadcasting - reuses the Zod schema
    // from @taskflow/shared so the shape is always consistent with the client type
    const presencePayload = presenceUserSchema.safeParse({ userId, name: userName, color });
    if (!presencePayload.success) return;

    socket.broadcast.to(room).emit(SOCKET_EVENTS.PRESENCE_JOIN, presencePayload.data);

    const peers = await io.in(room).fetchSockets();
    const roster = new Map<string, { userId: string; name: string | null; color: string }>();

    for (const peer of peers) {
      if (peer.id === socket.id) continue;
      const data = peer.data;
      roster.set(data.userId, { userId: data.userId, name: data.userName, color: data.color });
    }

    socket.emit(SOCKET_EVENTS.PRESENCE_SYNC, { users: [...roster.values()] });
    logger.debug({ userId, room, socketId: socket.id }, "Socket joined board room");
  }

  return { joinBoardRoom };
}

/**
 * True when the user still has another socket in `room` besides `socket`.
 * Filters by socket id (not by presence in the list) so it is correct both
 * during `disconnecting` (socket still listed) and after an await (already gone).
 */
async function userHasAnotherSocket(
  io: AppServer,
  socket: AppSocket,
  room: string,
  userId: string,
): Promise<boolean> {
  const peers = await io.in(room).fetchSockets();
  return peers.some((peer) => peer.id !== socket.id && peer.data.userId === userId);
}

/**
 * Emits presence:leave ONLY when the user has no other socket left in the
 * room - otherwise closing one of two tabs told everyone they had left.
 *
 * `disconnecting` fires while the socket is still in its rooms, and by the
 * time fetchSockets() resolves it may already be gone: filtering by socket
 * id (not by presence in the list) is correct in both cases.
 */
async function emitLeaveIfLastSocket(
  io: AppServer,
  socket: AppSocket,
  room: string,
): Promise<void> {
  const { userId } = socket.data;

  if (await userHasAnotherSocket(io, socket, room, userId)) {
    logger.debug({ userId, room }, "presence:leave skipped = another tab is still open");
    return;
  }

  // io.to().except() instead of socket.broadcast: this runs after an await,
  // when the socket may already be fully disconnected.
  io.to(room).except(socket.id).emit(SOCKET_EVENTS.PRESENCE_LEAVE, { userId });
  logger.debug({ userId, room }, "Broadcast presence:leave");
}

// ---------------------------------------------------------- Global org presence

/**
 * Emits presence:online to the user's orgs when this is their FIRST socket.
 * "First" = the personal room holds no other socket of the same user.
 */
export async function announceOnlineIfFirst(
  io: AppServer,
  socket: AppSocket,
  orgIds: string[],
): Promise<void> {
  const { userId } = socket.data;
  const personalRoom = `${SOCKET_USER_ROOM_PREFIX}${userId}`;

  if (await userHasAnotherSocket(io, socket, personalRoom, userId)) return;

  for (const orgId of orgIds) {
    io.to(`${SOCKET_ORG_ROOM_PREFIX}${orgId}`)
      .except(socket.id)
      .emit(SOCKET_EVENTS.PRESENCE_ONLINE, { userId });
  }
}

/**
 * Emits presence:offline to the user's orgs when this is their LAST socket.
 * Runs on `disconnecting`, while the socket is still listed in its rooms.
 */
export async function announceOfflineIfLast(
  io: AppServer,
  socket: AppSocket,
  orgIds: string[],
): Promise<void> {
  const { userId } = socket.data;
  const personalRoom = `${SOCKET_USER_ROOM_PREFIX}${userId}`;

  if (await userHasAnotherSocket(io, socket, personalRoom, userId)) return;

  for (const orgId of orgIds) {
    io.to(`${SOCKET_ORG_ROOM_PREFIX}${orgId}`)
      .except(socket.id)
      .emit(SOCKET_EVENTS.PRESENCE_OFFLINE, { userId });
  }
}

/**
 * Sends the joining socket the set of users already online across its orgs,
 * deduplicated by userId (multiple tabs = one entry). Mirrors PRESENCE_SYNC
 * but at org scope: answers "who on my team is online" vs "who is on this board".
 */
export async function buildOnlineSync(
  io: AppServer,
  socket: AppSocket,
  orgIds: string[],
): Promise<void> {
  const online = new Set<string>();

  for (const orgId of orgIds) {
    const peers = await io.in(`${SOCKET_ORG_ROOM_PREFIX}${orgId}`).fetchSockets();
    for (const peer of peers) {
      if (peer.id === socket.id) continue;
      online.add(peer.data.userId);
    }
  }

  socket.emit(SOCKET_EVENTS.PRESENCE_ONLINE_SYNC, { userIds: [...online] });
}
