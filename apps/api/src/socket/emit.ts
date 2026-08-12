import {
  SOCKET_ORG_ROOM_PREFIX,
  SOCKET_ROOM_PREFIX,
  SOCKET_USER_ROOM_PREFIX,
} from "@taskflow/shared";
import type { ServerToClientEvents } from "@taskflow/shared";
import type { AppServer } from "./events";

/** Names of every server -> client event, derived from the shared contract. */
type ServerEvent = keyof ServerToClientEvents;

/** Payload type for a given server event - every event takes exactly one object argument. */
type ServerEventPayload<Ev extends ServerEvent> = Parameters<ServerToClientEvents[Ev]>[0];

/**
 * `excludeUserId`, when given, skips the acting user's own connections (via
 * their personal `user:` room, which every authenticated socket joins at
 * handshake - see socket/server.ts) so they don't race their own mutation's
 * HTTP response against their own broadcast echo: a WebSocket push (server
 * -> client only) structurally beats a full HTTP request/response round
 * trip under any real latency, so without this, the acting user's own
 * screen updates before their own loading indicator clears. Their own view
 * updates from their own mutation's response instead (each router's
 * client-side onSuccess calls `setData` directly, mirroring what the
 * socket handler does for everyone else) - only OTHER viewers need this
 * broadcast at all.
 */
function targetRoom(io: AppServer, room: string, excludeUserId?: string) {
  return excludeUserId
    ? io.to(room).except(`${SOCKET_USER_ROOM_PREFIX}${excludeUserId}`)
    : io.to(room);
}

/**
 * Emits are generic over `Ev`, so TS can't verify a single `payload` value
 * against the specific overload `.emit()` expects for that particular
 * event - well-documented boundary, safe because `ServerEventPayload<Ev>`
 * is defined as `Parameters<ServerToClientEvents[Ev]>[0]`, the exact type
 * `.emit()` itself requires for event `Ev`.
 */
function emit<Ev extends ServerEvent>(
  target: ReturnType<typeof targetRoom>,
  event: Ev,
  payload: ServerEventPayload<Ev>,
): void {
  target.emit(event, ...([payload] as Parameters<ServerToClientEvents[Ev]>));
}

/** Broadcasts a typed event to every socket in a project room. */
export function emitToProject<Ev extends ServerEvent>(
  io: AppServer,
  projectId: string,
  event: Ev,
  payload: ServerEventPayload<Ev>,
  excludeUserId?: string,
): void {
  emit(targetRoom(io, `${SOCKET_ROOM_PREFIX}${projectId}`, excludeUserId), event, payload);
}

/** Broadcasts a typed event to a single user's personal room. */
export function emitToUser<Ev extends ServerEvent>(
  io: AppServer,
  userId: string,
  event: Ev,
  payload: ServerEventPayload<Ev>,
): void {
  emit(io.to(`${SOCKET_USER_ROOM_PREFIX}${userId}`), event, payload);
}

/** Broadcasts a typed event to every socket in an org room (joined at handshake). */
export function emitToOrg<Ev extends ServerEvent>(
  io: AppServer,
  orgId: string,
  event: Ev,
  payload: ServerEventPayload<Ev>,
  excludeUserId?: string,
): void {
  emit(targetRoom(io, `${SOCKET_ORG_ROOM_PREFIX}${orgId}`, excludeUserId), event, payload);
}
