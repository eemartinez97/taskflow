import { vi, type MockInstance } from "vitest";

type MockFn = MockInstance<(...args: unknown[]) => unknown>;

interface ModelMock {
  findUnique: MockFn;
  findMany: MockFn;
  create: MockFn;
  update: MockFn;
  delete: MockFn;
}

export interface MockOps {
  user: ModelMock & { upsert: MockFn };
  session: Pick<ModelMock, "findUnique" | "create" | "delete"> & { deleteMany: MockFn };
  org: ModelMock;
  membership: ModelMock & { upsert: MockFn };
  project: ModelMock;
  board: ModelMock;
  column: ModelMock & { upsert: MockFn };
  task: ModelMock;
  comment: Pick<ModelMock, "findUnique" | "findMany" | "create" | "delete">;
  label: Pick<ModelMock, "findUnique" | "findMany" | "create" | "delete">;
  taskLabel: { createMany: MockFn; deleteMany: MockFn };
}

const fn = (): MockFn => vi.fn();

export const mockOps: MockOps = {
  user: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
    upsert: fn(),
  },
  session: { findUnique: fn(), create: fn(), delete: fn(), deleteMany: fn() },
  org: { findUnique: fn(), findMany: fn(), create: fn(), update: fn(), delete: fn() },
  membership: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
    upsert: fn(),
  },
  project: { findUnique: fn(), findMany: fn(), create: fn(), update: fn(), delete: fn() },
  board: { findUnique: fn(), findMany: fn(), create: fn(), update: fn(), delete: fn() },
  column: {
    findUnique: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    delete: fn(),
    upsert: fn(),
  },
  task: { findUnique: fn(), findMany: fn(), create: fn(), update: fn(), delete: fn() },
  comment: { findUnique: fn(), findMany: fn(), create: fn(), delete: fn() },
  label: { findUnique: fn(), findMany: fn(), create: fn(), delete: fn() },
  taskLabel: { createMany: fn(), deleteMany: fn() },
};
