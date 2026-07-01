/**
 * Mock for @taskflow/database used in apps/web unit tests.
 *
 * Pattern mirrors app/api/tests/mocks/database-mock.ts:
 * a plain object of vi.fn() spies - no real Prisma client.
 *
 * Activate in vitest.config.ts via the `resolve.alias` key
 * OR per test file via:
 *   vi.mock("@taskflow/database", () => import("../mocks/database.ts"))
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

function fn(): MockFn {
  return vi.fn();
}

export const mockDb: WebMockDb = {
  user: {
    findUnique: fn(),
    create: fn(),
  },
};

/** Typed prisma export matching what auth.ts and route handlers import */
export const prisma = mockDb;

/**
 * Semantic alias - import `webMockDb` in test files so it reads
 * as "the mock" rather than "the real prisma client".
 */
export const webMockDb = mockDb;

/** Re-export PrismaAdapter as a no-op so auth.ts does not throw */
export const PrismaAdapter = vi.fn(() => ({}));
