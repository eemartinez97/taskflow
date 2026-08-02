import type {
  Column,
  Task,
  Board,
  OrgWithMembership,
  Project,
  Membership,
  Label,
} from "@taskflow/database";
import type { SocketTask } from "@taskflow/shared";
import { type PrismaClient } from "@taskflow/database";
import { mockDb } from "@/tests/mocks/taskflow-database";
import {
  VALID_USER_ID,
  VALID_BOARD_ID,
  VALID_COL_A_ID,
  VALID_PROJECT_ID,
  VALID_ORG_ID,
  VALID_TASK_1_ID,
  mockAuthorizedUser,
} from "@/tests/support/fixtures";

/** Pre-cast mockDb as PrismaClient - avoids repeating the cast in every test. */
export const db = mockDb as unknown as PrismaClient;

/** Creates a minimal Column fixture with optional overrides. */
export function makeColumn(overrides: Partial<Column> = {}): Column {
  const id = overrides.id ?? VALID_COL_A_ID;
  return {
    id,
    boardId: VALID_BOARD_ID,
    name: "To Do",
    position: 1000,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Creates a minimal Task fixture with optional overrides. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: VALID_TASK_1_ID,
    columnId: VALID_COL_A_ID,
    title: "Fix login bug",
    description: null,
    assigneeId: null,
    priority: "NONE",
    status: "TODO",
    position: 1000,
    creatorId: VALID_USER_ID,
    dueDate: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Creates a minimal Board fixture with optional overrides. */
export function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: VALID_BOARD_ID,
    projectId: VALID_PROJECT_ID,
    name: "Main Board",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/**
 * Options for makeOrg(). Extends Partial<OrgWithMembership> with a `role`
 * shorthand so call sites don't need to hand-build `memberships` for the
 * common case of "one membership with role X for the current user".
 */
interface MakeOrgOptions extends Omit<Partial<OrgWithMembership>, "memberships"> {
  /** Shorthand: builds `memberships: [makeMembership({ role })]`. Ignored if `memberships` is also passed. */
  role?: Membership["role"];
  memberships?: OrgWithMembership["memberships"];
}

/** Creates a minimal OrgWithMembership fixture with optional overrides. */
export function makeOrg(overrides: MakeOrgOptions = {}): OrgWithMembership {
  const { role, memberships, name, slug, ...rest } = overrides;
  const resolvedName = name ?? "Acme Corp";
  return {
    id: VALID_ORG_ID,
    name: resolvedName,
    slug: slug ?? resolvedName.toLowerCase().replace(/\s+/g, "-"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    memberships: memberships ?? [makeMembership({ role: role ?? "OWNER" })],
    ...rest,
  };
}

/** Creates a minimal Project fixture. */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: VALID_PROJECT_ID,
    orgId: VALID_ORG_ID,
    name: "Demo Project",
    key: "DEMO",
    slug: "demo-project",
    description: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Creates a minimal OrgMembership fixture with optional overrides. */
export function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: "m1",
    orgId: VALID_ORG_ID,
    userId: mockAuthorizedUser.id,
    role: "OWNER" as const,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/**
 * Creates a minimal Label fixture with optional overrides. Positional
 * `id`/`name` (every call site names its label deliberately); `color`/`orgId`
 * are the only other fields tests ever vary, so they live in the options bag.
 */
export function makeLabel(
  id: string,
  name: string,
  options: { color?: string; orgId?: string } = {},
): Label {
  return {
    id,
    name,
    color: options.color ?? "#3B82F6",
    orgId: options.orgId ?? VALID_ORG_ID,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

/**
 * Converts a local Task fixture to SocketTask shape.
 * Dates are kept as Date objects to match the shared type definition.
 */
export function toSocketTask(task: ReturnType<typeof makeTask>): SocketTask {
  return {
    id: task.id,
    columnId: task.columnId,
    title: task.title,
    description: task.description,
    assigneeId: task.assigneeId,
    priority: task.priority,
    status: task.status,
    creatorId: task.creatorId,
    position: task.position,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
