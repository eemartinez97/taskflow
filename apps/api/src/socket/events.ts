import type { Comment, Task } from "@taskflow/database";
import type { PresenceCursor, PresenceUser, SOCKET_EVENTS } from "@taskflow/shared";

/**
 * Events the server can emit TO the client.
 *
 * Computed property keys work here because SOCKET_EVENTS is `as const` -
 * TypeScript resolves each value to its string literal type, which is a
 * valid computed key in an interface
 */
export interface ClientToServerEvents {
  // Presence - cursor position update (throttled 50ms client-side)
  [SOCKET_EVENTS.PRESENCE_CURSOR]: (payload: PresenceCursor) => void;
  // Typing indicator - client emits when user starts typing on a task
  [SOCKET_EVENTS.TASK_TYPING]: (payload: { taskId: string; userId: string }) => void;
}

/**
 * Events the server sends TO the client.
 * All payloads are plain JSON - superjson is tRPC-only
 */
export interface ServerToClientEvents {
  // Task lifecycle
  [SOCKET_EVENTS.TASK_CREATED]: (payload: { task: Task }) => void;
  [SOCKET_EVENTS.TASK_UPDATED]: (payload: { task: Task }) => void;
  [SOCKET_EVENTS.TASK_MOVED]: (payload: { task: Task }) => void;
  [SOCKET_EVENTS.TASK_DELETED]: (payload: { taskId: string }) => void;
  // Typing indicator - re-broadcast to other members in the same project room
  [SOCKET_EVENTS.TASK_TYPING]: (payload: { taskId: string; userId: string }) => void;
  // Comments
  [SOCKET_EVENTS.COMMENT_CREATED]: (payload: { comment: Comment }) => void;
  // Presence
  [SOCKET_EVENTS.PRESENCE_JOIN]: (payload: PresenceUser) => void;
  [SOCKET_EVENTS.PRESENCE_LEAVE]: (payload: { userId: string }) => void;
  [SOCKET_EVENTS.PRESENCE_CURSOR]: (payload: PresenceCursor) => void;
}

/**
 * Per-socket data attached during the auth handshake and readable in
 * all event handlers via socket.data.
 * `color` is resolved once at handshake so presence events never recompute it.
 */
export interface SocketData {
  userId: string;
  userEmail: string;
  userName: string | null;
  /** Hex color assigned on join for cursor / avatar display */
  color: string;
}

/**
 * Inter-server events - typed now so Server<C, S, I, D> generic is complete.
 * Required when adding a Redis/cluster adapter for horizontal scaling
 */
export interface InterServerEvents {
  ping: () => void;
}
