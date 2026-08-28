import { vi, type MockInstance } from "vitest";

/**
 * Every Prisma delegate returns a Promise, so typing the return as
 * `Promise<unknown>` is what unlocks `.mockResolvedValue()` in tests.
 * Exported because tests/support/repo-contract.ts needs to name it.
 */
export type MockFn = MockInstance<(...args: unknown[]) => unknown>;

export interface ModelMock {
  findUnique: MockFn;
  findUniqueOrThrow: MockFn;
  findFirst: MockFn;
  findMany: MockFn;
  create: MockFn;
  update: MockFn;
  updateMany: MockFn;
  upsert: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
  count: MockFn;
}

/**
 * Single source of truth for the models the API touches.
 * Adding a model to schema.prisma? Add it here and every test gets it.
 */
export const MODEL_NAMES = [
  "user",
  "session",
  "org",
  "membership",
  "project",
  "board",
  "column",
  "task",
  "taskLabel",
  "comment",
  "label",
  "notification",
  "invitation",
] as const;

export type ModelName = (typeof MODEL_NAMES)[number];

export type MockOps = Record<ModelName, ModelMock> & {
  $transaction: MockFn;
  $queryRaw: MockFn;
  $executeRawUnsafe: MockFn;
};

const makeModelMock = (): ModelMock => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
});

export const mockOps: MockOps = {
  ...(Object.fromEntries(MODEL_NAMES.map((m) => [m, makeModelMock()])) as Record<
    ModelName,
    ModelMock
  >),
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
};

/**
 * Re-applies the default behaviours wiped by `vi.resetAllMocks()`.
 * Called from tests/setup.ts on every `beforeEach` - see tests/support/reset.ts.
 *
 * `$transaction` gets a real implementation because repos await it directly
 * (createDefaultBoard, reorderColumns, setColumnStatus) and `await undefined`
 * silently hides the fact that the operations were never resolved. Handles
 * both call shapes Prisma supports: an array of pending queries (batched
 * transaction), and a callback receiving a `tx` client (interactive
 * transaction, e.g. boards/service.ts's setColumnStatus) - `tx` is just
 * `mockOps` itself here, same delegates every other repo call already uses.
 */
export function armDbMocks(): void {
  mockOps.$transaction.mockImplementation(async (ops: unknown) => {
    if (typeof ops === "function") {
      return (ops as (tx: MockOps) => unknown)(mockOps);
    }
    return Array.isArray(ops) ? Promise.all(ops) : undefined;
  });
}
