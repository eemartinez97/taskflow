// Shared test fixtures for all schema tests in packages/shared.
// Import from here instead of redefining in each test file.

export const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

/** A second distinct UUID for tests that require two different IDs (e.g. author ≠ task) */
export const ANOTHER_UUID = "123e4567-e89b-12d3-a456-426614174000";

// Fixed date so snapshots and comparisons are deterministic
export const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z");

// Minimal valid task payload reused across socket and task tests
export const validTaskPayload = {
  id: VALID_UUID,
  columnId: VALID_UUID,
  title: "Fix login bug",
  description: null,
  assigneeId: null,
  priority: "HIGH" as const,
  status: "IN_PROGRESS" as const,
  position: 1000,
  dueDate: null,
  creatorId: VALID_UUID,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Minimal valid user payload reused across user and socket tests
export const validUserPayload = {
  id: VALID_UUID,
  name: "Alice",
  email: "alice@example.com",
  image: "https://example.com/avatar.png",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Org
export const validOrgPayload = {
  id: VALID_UUID,
  name: "Test Corp",
  slug: "test-corp",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Membership
export const validMembershipPayload = {
  id: VALID_UUID,
  orgId: VALID_UUID,
  userId: ANOTHER_UUID,
  role: "ADMIN" as const,
  cursorsHidden: false,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Project
export const validProjectPayload = {
  id: VALID_UUID,
  orgId: ANOTHER_UUID,
  name: "Demo Project",
  key: "DEMO",
  slug: "demo-project",
  description: "A demonstration project",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Board
export const validBoardPayload = {
  id: VALID_UUID,
  projectId: ANOTHER_UUID,
  name: "Main Board",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Column
export const validColumnPayload = {
  id: VALID_UUID,
  boardId: ANOTHER_UUID,
  name: "To Do",
  position: 1000,
  mappedStatus: "TODO",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Comment
export const validCommentPayload = {
  id: VALID_UUID,
  taskId: ANOTHER_UUID,
  authorId: ANOTHER_UUID,
  body: "LGTM",
  author: {
    id: VALID_UUID,
    name: "Alice",
    email: "alice@example.com",
    image: "https://example.com/avatar.png",
  },
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Label
export const validLabelPayload = {
  id: VALID_UUID,
  orgId: ANOTHER_UUID,
  name: "Bug",
  color: "#EF4444",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Notification
export const validNotification = {
  id: VALID_UUID,
  userId: ANOTHER_UUID,
  actorId: ANOTHER_UUID,
  type: "COMMENT_CREATED",
  message: 'Bob commented on "Fix login bug"',
  read: false,
  entityId: ANOTHER_UUID,
  entityType: "task",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  actor: { id: ANOTHER_UUID, name: "Bob", image: "https://example.com/bob.png" },
};
