import { vi, type MockInstance } from "vitest";

type MockFn = MockInstance<(...args: unknown[]) => unknown>;

interface ModelMock {
  findUnique: MockFn;
  findFirst: MockFn;
  findMany: MockFn;
  create: MockFn;
  update: MockFn;
  updateMany: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
  count: MockFn;
}

export interface MockOps {
  user: Pick<ModelMock, "findUnique">;
  session: Pick<ModelMock, "findUnique" | "deleteMany">;
  org: Pick<ModelMock, "findUnique" | "findMany" | "create" | "update" | "delete">;
  membership: Pick<ModelMock, "findUnique" | "findMany" | "create" | "delete">;
  project: Pick<ModelMock, "findUnique" | "findMany" | "create" | "update" | "delete">;
  board: Pick<ModelMock, "findUnique" | "findMany" | "create" | "update" | "findFirst">;
  column: Pick<ModelMock, "create" | "update" | "findFirst">;
  task: Pick<ModelMock, "findUnique" | "findMany" | "create" | "update" | "delete" | "findFirst">;
  comment: Pick<ModelMock, "findUnique" | "findMany" | "create" | "delete">;
  label: Pick<ModelMock, "findMany" | "create" | "delete">;
  notification: Pick<ModelMock, "findMany" | "create" | "updateMany" | "delete" | "count">;
  $transaction: MockFn;
}

const fn = (): MockFn => vi.fn();

export const mockOps: MockOps = {
  user: { findUnique: fn() },
  session: { findUnique: fn(), deleteMany: fn() },
  org: { findUnique: fn(), findMany: fn(), create: fn(), update: fn(), delete: fn() },
  membership: { findUnique: fn(), findMany: fn(), create: fn(), delete: fn() },
  project: { findUnique: fn(), findMany: fn(), create: fn(), update: fn(), delete: fn() },
  board: { findUnique: fn(), findMany: fn(), create: fn(), update: fn(), findFirst: fn() },
  column: { create: fn(), update: fn(), findFirst: fn() },
  task: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
    findFirst: fn(),
  },
  comment: { findUnique: fn(), findMany: fn(), create: fn(), delete: fn() },
  label: { findMany: fn(), create: fn(), delete: fn() },
  notification: { findMany: fn(), create: fn(), updateMany: fn(), delete: fn(), count: fn() },
  $transaction: fn(),
};
