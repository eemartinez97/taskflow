/**
 * @fileoverview Mock module for @taskflow/database.
 *
 * This file is the alias target configured in vitest.config.ts (unit project).
 * Every unit test that imports from "@taskflow/database" receives this mock
 * instead of the real Prisma client.
 *
 * To control per-test behavior:
 *   import { mockDb } from "tests/mocks/database-mock
 *   mockDb.session.findUnique.mockResolvedValueOnce(...)
 *
 * Integration tests (tests/integration/) use the real @taskflow/database
 * via Testcontainers — the alias is scoped to the "unit" project only.
 */

import { mockOps, type MockOps } from "./database";

export const prisma: MockOps = mockOps;

// Alias for semantic clarity in test files — "mockDb" signals intent better
// than importing "prisma" (which sounds like the real thing)
export const mockDb = mockOps;

export const userBasicSelect = {
  id: true,
  name: true,
  email: true,
} as const;

export const userProfileSelect = {
  id: true,
  name: true,
  image: true,
} as const;

export const membershipWithUser = {
  user: { select: { id: true, name: true, email: true } },
} as const;

export const orgWithMembership = {
  memberships: { select: { role: true } },
} as const;

export const boardWithColumns = {
  columns: { orderBy: { position: "asc" as const } },
} as const;

export const notificationWithActor = {
  actor: { select: { id: true, name: true, image: true } },
} as const;
