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
  "INVITATION_ACCEPTED",
  "INVITATION_DECLINED",
  "MEMBER_LEFT",
] as const;

// Invitation lifecycle states - no EXPIRED member, see the Invitation model's
// docblock in packages/database for why expiry is derived, not stored.
export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "REVOKED"] as const;

// 7 days - stamped on every issued/resent invitation token and rendered in
// both the invite email and the token page, same pattern as AUTH_TOKEN_TTL_HOURS.
export const INVITATION_TTL_HOURS = 168;

// Caps the number of PENDING invitations a single org can have outstanding
// at once - guards against one admin (or a compromised admin account)
// spamming invite emails.
export const MAX_PENDING_INVITATIONS_PER_ORG = 100;

// Minimum time between resends of the SAME invitation - guards against an
// admin (accidentally or otherwise) hammering "resend" and spamming the
// invitee's inbox.
export const INVITATION_RESEND_COOLDOWN_MS = 60_000;

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
  // Bulk status sync when a column's status mapping changes - see
  // boards/service.ts's setColumnStatus. Distinct from TASK_UPDATED since one
  // mapping change can affect many tasks at once; carries ids, not full rows.
  TASK_STATUS_BULK_UPDATED: "task:status_bulk_updated",
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
  // Sent org-wide when a member's own profile (name) changes, so peers'
  // already-cached presence rosters and cursor labels correct themselves
  // without waiting for that member's socket to reconnect.
  PRESENCE_USER_UPDATED: "presence:user-updated",
  // Typing indicator (client -> server, server -> room)
  TASK_TYPING: "task:typing",
  // Invitation events (server -> client). RECEIVED goes to the invitee's
  // personal user: room (they aren't an org member yet, so no org room to
  // use); RESOLVED goes to the org: room so the admin's invitations table
  // updates live on accept/decline/revoke.
  INVITATION_RECEIVED: "invitation:received",
  INVITATION_RESOLVED: "invitation:resolved",
} as const;

/** Union type of all valid socket event name strings. */
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
