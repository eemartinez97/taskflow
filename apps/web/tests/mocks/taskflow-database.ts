/**
 * Mock for `@taskflow/database` used in apps/web unit tests.
 *
 * Exports every symbol that web app modules import from `@taskflow/database`.
 * With the JWT session strategy, database adapters are no longer used for auth,
 * leaving only the base prisma mock for standard DB operations if needed.
 */

import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

interface UserModelMock {
  findUnique: MockFn;
  create: MockFn;
}

export interface WebMockDb {
  user: UserModelMock;
}

const fn = (): MockFn => vi.fn();

export const mockDb: WebMockDb = {
  user: { findUnique: fn(), create: fn() },
};

/** Named alias for semantic clarity in test files. */
export const webMockDb = mockDb;

/** Matches `import { prisma } from "@taskflow/database"` */
export const prisma = mockDb;

export type PrismaClient = typeof mockDb;
