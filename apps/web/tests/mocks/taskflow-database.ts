/**
 * Mock for `@taskflow/database` used in apps/web unit tests.
 *
 * Exports every symbol that web app modules import from `@taskflow/database`:
 *   - prisma / mockDb  : mock PrismaClient with vi.fn() model methods
 *   - validateSessionToken : vi.fn() wrapping the real session-check logic
 *   - PrismaAdapter    : no-op so auth.ts doesn't throw at import time
 *
 * Activate per test file via vitest alias (vitest.config.ts) or:
 *   vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database.js"));
 */

import type { SessionUser } from "@taskflow/shared";
import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

interface UserModelMock {
  findUnique: MockFn;
  create: MockFn;
}

interface SessionModelMock {
  findUnique: MockFn;
}

export interface WebMockDb {
  user: UserModelMock;
  session: SessionModelMock;
}

const fn = (): MockFn => vi.fn();

export const mockDb: WebMockDb = {
  session: { findUnique: fn() },
  user: { findUnique: fn(), create: fn() },
};

/** Named alias for semantic clarity in test files. */
export const webMockDb = mockDb;

/** Matches `import { prisma } from "@taskflow/database"` */
export const prisma = mockDb;

/**
 * Mocked validateSessionToken.
 *
 * Default behaviour: returns null (unauthenticated).
 * Override per test:
 *   vi.mocked(validateSessionToken).mockResolvedValueOnce(mockServerSessionUser);
 */
export const validateSessionToken = vi.fn<
  (db: unknown, token: string) => Promise<SessionUser | null>
>(() => Promise.resolve(null));

/** No-op adapter so auth.ts doesn't throw at import time. */
export const PrismaAdapter = vi.fn(() => ({}));

export type PrismaClient = typeof mockDb;
