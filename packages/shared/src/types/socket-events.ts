/**
 * Payload types for every Socket.IO event - derived from Zod schemas.
 *
 * NOTE: Socket.IO serializes over JSON so `Date` fields arrive as ISO
 * strings at runtime.  Types use `Date` for schema correctness;
 * callers cast where needed.
 */
import type { z } from "zod";
import type {
  commentSchema,
  presenceCursorSchema,
  presenceUserSchema,
  taskSchema,
} from "../schemas";
import type { SOCKET_EVENTS } from "../constants";

export type SocketTask = z.infer<typeof taskSchema>;
export type SocketComment = z.infer<typeof commentSchema>;
export type SocketPresenceUser = z.infer<typeof presenceUserSchema>;
export type SocketCursor = z.infer<typeof presenceCursorSchema>;

/** Events emitted FROM the client TO the server. */
export interface ClientToServerEvents {
  [SOCKET_EVENTS.PRESENCE_CURSOR]: (payload: SocketCursor) => void;
  [SOCKET_EVENTS.TASK_TYPING]: (payload: { taskId: string; userId: string }) => void;
}

/** Events emitted FROM the server TO the client. */
export interface ServerToClientEvents {
  [SOCKET_EVENTS.TASK_CREATED]: (payload: { task: SocketTask }) => void;
  [SOCKET_EVENTS.TASK_UPDATED]: (payload: { task: SocketTask }) => void;
  [SOCKET_EVENTS.TASK_MOVED]: (payload: { task: SocketTask }) => void;
  [SOCKET_EVENTS.TASK_DELETED]: (payload: { taskId: string }) => void;
  [SOCKET_EVENTS.TASK_TYPING]: (payload: { taskId: string; userId: string }) => void;
  [SOCKET_EVENTS.COMMENT_CREATED]: (payload: { comment: SocketComment }) => void;
  [SOCKET_EVENTS.PRESENCE_JOIN]: (payload: SocketPresenceUser) => void;
  [SOCKET_EVENTS.PRESENCE_LEAVE]: (payload: { userId: string }) => void;
  [SOCKET_EVENTS.PRESENCE_CURSOR]: (payload: SocketCursor) => void;
}
