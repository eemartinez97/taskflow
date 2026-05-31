// Shared test fixtures for all schema tests in packages/shared.
// Import from here instead of redefining in each test file.

export const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
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
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

// Minimal valid user payload reused across user and socket tests
export const validUserPayload = {
  id: VALID_UUID,
  name: "Alice",
  email: "alice@example.com",
  image: "https://example.com/avatar.com",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};
