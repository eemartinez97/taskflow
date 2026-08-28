/**
 * Payload types for every Socket.IO event - derived from Zod schemas.
 *
 * NOTE: Socket.IO serializes over JSON so `Date` fields arrive as ISO
 * strings at runtime.  Types use `Date` for schema correctness;
 * callers cast where needed.
 */
import type { z } from "zod";
import type {
  boardSchema,
  columnSchema,
  commentSchema,
  invitationStatusSchema,
  labelSchema,
  myInvitationSchema,
  notificationSchema,
  presenceCursorSchema,
  presenceUserSchema,
  taskSchema,
} from "../schemas";
import type { SOCKET_EVENTS } from "../constants";

export type SocketTask = z.infer<typeof taskSchema>;
export type SocketLabel = z.infer<typeof labelSchema>;
export type SocketComment = z.infer<typeof commentSchema>;
export type SocketCursor = z.infer<typeof presenceCursorSchema>;
export type SocketNotification = z.infer<typeof notificationSchema>;
export type SocketPresenceUser = z.infer<typeof presenceUserSchema>;
export type SocketColumn = z.infer<typeof columnSchema>;
export type SocketBoard = z.infer<typeof boardSchema> & { columns: SocketColumn[] };
export type SocketMyInvitation = z.infer<typeof myInvitationSchema>;
export type SocketInvitationStatus = z.infer<typeof invitationStatusSchema>;

/** Events emitted FROM the client TO the server. */
export interface ClientToServerEvents {
  [SOCKET_EVENTS.PRESENCE_CURSOR]: (payload: SocketCursor) => void;
  /** Signals the pointer left the tracked board area - no payload; the
   * server attaches the real userId, mirroring TASK_TYPING's pattern. */
  [SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE]: () => void;
  [SOCKET_EVENTS.TASK_TYPING]: (payload: { taskId: string; userId: string }) => void;
}

/** Events emitted FROM the server TO the client. */
export interface ServerToClientEvents {
  [SOCKET_EVENTS.TASK_CREATED]: (payload: { task: SocketTask }) => void;
  [SOCKET_EVENTS.TASK_UPDATED]: (payload: { task: SocketTask }) => void;
  [SOCKET_EVENTS.TASK_MOVED]: (payload: { task: SocketTask }) => void;
  [SOCKET_EVENTS.TASK_DELETED]: (payload: { taskId: string }) => void;
  [SOCKET_EVENTS.TASK_LABELS_CHANGED]: (payload: { taskId: string; labels: SocketLabel[] }) => void;
  /** Sent when a column's status mapping change bulk-syncs its existing tasks - see boards/service.ts's setColumnStatus. */
  [SOCKET_EVENTS.TASK_STATUS_BULK_UPDATED]: (payload: {
    columnId: string;
    status: SocketTask["status"];
    taskIds: string[];
  }) => void;
  [SOCKET_EVENTS.BOARD_UPDATED]: (payload: { board: SocketBoard }) => void;
  [SOCKET_EVENTS.TASK_TYPING]: (payload: { taskId: string; userId: string }) => void;
  [SOCKET_EVENTS.COMMENT_CREATED]: (payload: { comment: SocketComment }) => void;
  [SOCKET_EVENTS.COMMENT_DELETED]: (payload: { commentId: string; taskId: string }) => void;
  [SOCKET_EVENTS.NOTIFICATION_CREATED]: (payload: { notification: SocketNotification }) => void;
  [SOCKET_EVENTS.PRESENCE_JOIN]: (payload: SocketPresenceUser) => void;
  [SOCKET_EVENTS.PRESENCE_LEAVE]: (payload: { userId: string }) => void;
  [SOCKET_EVENTS.PRESENCE_CURSOR]: (payload: SocketCursor) => void;
  [SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE]: (payload: { userId: string }) => void;
  [SOCKET_EVENTS.PRESENCE_SYNC]: (payload: { users: SocketPresenceUser[] }) => void;
  [SOCKET_EVENTS.PRESENCE_ONLINE]: (payload: { userId: string }) => void;
  [SOCKET_EVENTS.PRESENCE_OFFLINE]: (payload: { userId: string }) => void;
  [SOCKET_EVENTS.PRESENCE_ONLINE_SYNC]: (payload: { userIds: string[] }) => void;
  /** Sent org-wide (see PRESENCE_USER_UPDATED) so peers correct an already-cached name. */
  [SOCKET_EVENTS.PRESENCE_USER_UPDATED]: (payload: { userId: string; name: string | null }) => void;
  /** Sent to the invitee's personal user: room - they aren't an org member yet, so no org room applies. */
  [SOCKET_EVENTS.INVITATION_RECEIVED]: (payload: { invitation: SocketMyInvitation }) => void;
  /** Sent to the org: room so the admin's invitations table updates live on accept/decline/revoke. */
  [SOCKET_EVENTS.INVITATION_RESOLVED]: (payload: {
    invitationId: string;
    orgId: string;
    status: SocketInvitationStatus;
  }) => void;
}
