import type { PrismaClient } from "@taskflow/database";
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
import { findUserOrgIds } from "./presence-repo";
import { emitToOrg } from "./emit";
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

interface PresenceRosterEntry {
  userId: string;
  name: string | null;
  color: string;
}

/**
 * Builds a de-duplicated (by userId) roster from a room's connected sockets.
 * Shared by joinBoardRoom and broadcastPresenceHeartbeat so the two never
 * drift on shape/dedup semantics again - see the heartbeat's own docblock
 * for the bug this fixed (heartbeat used to include the recipient's own
 * entry, which joinBoardRoom's independently-written loop never did).
 */
function buildRoomRoster(
  peers: { data: { userId: string; userName: string | null; color: string } }[],
): Map<string, PresenceRosterEntry> {
  const roster = new Map<string, PresenceRosterEntry>();
  for (const peer of peers) {
    roster.set(peer.data.userId, {
      userId: peer.data.userId,
      name: peer.data.userName,
      color: peer.data.color,
    });
  }
  return roster;
}

/** Stable string key for a roster - order-independent, used to skip no-op heartbeat emits. */
function rosterSignature(roster: Map<string, PresenceRosterEntry>): string {
  return JSON.stringify([...roster.values()].sort((a, b) => a.userId.localeCompare(b.userId)));
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
    const roster = buildRoomRoster(peers.filter((peer) => peer.id !== socket.id));

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

// ---------------------------------------------------------------- Heartbeat

/** How often the full board roster is re-broadcast - see broadcastPresenceHeartbeat. */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Re-broadcasts the full presence:sync roster to every board:<id> room on an
 * interval, so a client that never received its presence:leave packet - e.g.
 * a peer's socket held open past disconnect by connectionStateRecovery, or a
 * process crash that skipped the "disconnecting" handler entirely - self-
 * corrects within one interval instead of showing a stale viewer forever.
 * usePresence's client-side state is otherwise pure event-patch with no
 * other re-sync (apps/web/lib/hooks/use-presence.ts), so a single dropped
 * leave packet is not recoverable without this.
 *
 * Reads the adapter's live room registry rather than tracking board rooms
 * separately - that state would need the same join/leave bookkeeping this
 * heartbeat exists to backstop, and would drift the same way.
 *
 * Each recipient gets the room's roster with their OWN entry filtered out
 * (io.to(room).emit() can't do this - it sends one identical payload to
 * everyone - so this emits per-peer instead), matching joinBoardRoom's and
 * apps/web's documented "presence rosters exclude self" invariant.
 *
 * Skips the emit entirely for a room whose live membership (fetchSockets())
 * is byte-identical to what was last sent - `lastHeartbeatRosterSignature`
 * caches by room. This does NOT weaken the self-correction this heartbeat
 * exists for: membership is re-read from the adapter fresh every tick, so a
 * peer that actually left (even via a dropped presence:leave packet) changes
 * the signature and still triggers a resync on the very next tick.
 */
const lastHeartbeatRosterSignature = new Map<string, string>();

/** Test-only: clears the heartbeat's roster-diff cache between test cases. */
export function __resetPresenceHeartbeatCacheForTests(): void {
  lastHeartbeatRosterSignature.clear();
}

export async function broadcastPresenceHeartbeat(io: AppServer): Promise<void> {
  const rooms = [...io.of("/").adapter.rooms.keys()].filter((room) =>
    room.startsWith(SOCKET_BOARD_ROOM_PREFIX),
  );

  const activeRooms = new Set(rooms);
  for (const room of lastHeartbeatRosterSignature.keys()) {
    if (!activeRooms.has(room)) lastHeartbeatRosterSignature.delete(room);
  }

  await Promise.all(
    rooms.map(async (room) => {
      const peers = await io.in(room).fetchSockets();
      const roster = buildRoomRoster(peers);

      const signature = rosterSignature(roster);
      if (lastHeartbeatRosterSignature.get(room) === signature) return;
      lastHeartbeatRosterSignature.set(room, signature);

      for (const peer of peers) {
        const ownRoster = [...roster.values()].filter((entry) => entry.userId !== peer.data.userId);
        peer.emit(SOCKET_EVENTS.PRESENCE_SYNC, { users: ownRoster });
      }
    }),
  );
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

/**
 * Called after a user's own profile name changes (auth.updateProfile).
 * `socket.data.userName` is set once at handshake (server.ts's
 * authenticateSocket) and never re-read from the JWT for the socket's whole
 * lifetime, so without this, PRESENCE_JOIN/PRESENCE_SYNC on the next board
 * switch would keep re-broadcasting the OLD name even after the mutation
 * succeeds and the NextAuth session itself has already been updated.
 *
 * No Redis/cluster adapter is configured (see events.ts's InterServerEvents
 * docblock) - every connected socket lives in this same process, and the
 * default in-memory adapter's fetchSockets() returns the real local Socket
 * instances (not a serialized snapshot), so mutating `.data` here directly
 * takes effect immediately for any future room join.
 *
 * That alone doesn't fix rosters/cursor labels peers have ALREADY cached
 * from a join that happened before this update - PRESENCE_USER_UPDATED
 * corrects those live, without waiting for the changed user's socket to
 * reconnect or for peers to re-join the board.
 */
export async function broadcastProfileNameUpdate(
  io: AppServer,
  db: PrismaClient,
  userId: string,
  name: string | null,
): Promise<void> {
  const [sockets, orgIds] = await Promise.all([
    io.in(`${SOCKET_USER_ROOM_PREFIX}${userId}`).fetchSockets(),
    findUserOrgIds(db, userId),
  ]);
  for (const socket of sockets) {
    socket.data.userName = name;
  }

  for (const orgId of orgIds) {
    emitToOrg(io, orgId, SOCKET_EVENTS.PRESENCE_USER_UPDATED, { userId, name });
  }
}
