/**
 * Mock for `@taskflow/database` used in apps/web unit tests.
 *
 * Exports every symbol that web app modules import from `@taskflow/database`.
 * With the JWT session strategy, database adapters are no longer used for auth,
 * leaving only the base prisma mock for standard DB operations if needed.
 */

import { vi } from "vitest";

interface UserModelMock {
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

export const mockDb: { user: UserModelMock } = {
  user: { findUnique: vi.fn(), create: vi.fn() },
};

/** Matches `import { prisma } from "@taskflow/database"` */
export const prisma = mockDb;
