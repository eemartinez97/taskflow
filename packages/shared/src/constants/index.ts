// Role hierarchy for RBAC - order matters (higher index = more permissions)
export const ROLES = ["VIEWER", "MEMBER", "ADMIN", "OWNER"] as const;

export const TASK_PRIORITIES = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"] as const;

// All notification event types
export const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "TASK_UPDATED",
  "COMMENT_CREATED",
  "MEMBER_INVITED",
] as const;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// Socket.IO room prefix
export const SOCKET_ROOM_PREFIX = "project:" as const;

// Per-user room prefix - notifications are pushed here
export const SOCKET_USER_ROOM_PREFIX = "user:" as const;

export const SOCKET_ORG_ROOM_PREFIX = "org:" as const;

export const SOCKET_BOARD_ROOM_PREFIX = "board:" as const;

// Position step for lexorank-style ordering (functional float)
export const POSITION_STEP = 1000;

// Socket event names
// Single source of truth for ALL socket event strings.
// Import SOCKET_EVENTS instead of writing raw strings - prevents typos and
// provides IDE autocompletion on both the server (apps/api) and the client (apps/web)
export const SOCKET_EVENTS = {
  // Task events (server -> client)
  TASK_CREATED: "task:created",
  TASK_UPDATED: "task:updated",
  TASK_MOVED: "task:moved",
  TASK_DELETED: "task:deleted",
  TASK_LABELS_CHANGED: "task:labels_changed",
  // Board events (server -> client): any board/column change
  BOARD_UPDATED: "board:updated",
  // Comment events (server -> client)
  COMMENT_CREATED: "comment:created",
  COMMENT_DELETED: "comment:deleted",
  // Notification events (server -> client, per-user room)
  NOTIFICATION_CREATED: "notification:created",
  // Presence events (bidirectional)
  PRESENCE_JOIN: "presence:join",
  PRESENCE_LEAVE: "presence:leave",
  PRESENCE_CURSOR: "presence:cursor",
  PRESENCE_CURSOR_LEAVE: "presence:cursor:leave",
  // Global person presence, scoped to the user's orgs (not per-project).
  PRESENCE_ONLINE: "presence:online",
  PRESENCE_OFFLINE: "presence:offline",
  PRESENCE_ONLINE_SYNC: "presence:online-sync",
  // Sent only to the joining socket: who is already in the room
  PRESENCE_SYNC: "presence:sync",
  // Typing indicator (client -> server, server -> room)
  TASK_TYPING: "task:typing",
} as const;

/** Union type of all valid socket event name strings. */
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
