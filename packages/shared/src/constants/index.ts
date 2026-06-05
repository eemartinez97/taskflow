// Role hierarchy for RBAC - order matters (higher index = more permissions)
export const ROLES = ["VIEWER", "MEMBER", "ADMIN", "OWNER"] as const;

export const TASK_PRIORITIES = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"] as const;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// Socket.IO room prefix
export const SOCKET_ROOM_PREFIX = "project:" as const;

// Position step for lexorank-style ordering (functional float)
export const POSITION_STEP = 1000;
