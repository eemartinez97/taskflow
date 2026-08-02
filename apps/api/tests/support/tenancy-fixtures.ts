import {
  assertBoardInOrg,
  assertColumnInOrg,
  assertLabelInOrg,
  assertProjectInOrg,
  assertTaskInOrg,
} from "../../src/modules/shared/tenancy";
import { ANOTHER_UUID, db, VALID_ORG_ID } from "../helpers";
import type { ModelName } from "../mocks/database";

/**
 * Single definition of every scoped resource's Prisma shape.
 * The nested `{ board: { project: { orgId } } }` chains live here ONCE;
 * TENANT and FOREIGN are just this function applied to two different orgs.
 */
function buildTenantShapes(orgId: string) {
  return {
    project: { orgId },
    label: { orgId },
    board: { project: { orgId } },
    column: { board: { project: { orgId } } },
    task: { column: { board: { project: { orgId } } } },
  } as const;
}

/** "Resource lives in the org" shapes. */
export const TENANT = buildTenantShapes(VALID_ORG_ID);

/** Same shapes, pointing at a different org (cross-tenant case). */
export const FOREIGN = buildTenantShapes(ANOTHER_UUID);

export type ResourceName = keyof typeof TENANT;

/** One row per scoped resource - drives the tenancy.test.ts describe.each. */
export interface TenancyCase {
  name: ResourceName;
  /** Prisma model the assertion is expected to hit. */
  model: ModelName;
  /** The value a matching findUnique resolves with. */
  inOrg: Record<string, unknown>;
  /** The value a cross-tenant findUnique resolves with. */
  foreign: Record<string, unknown>;
  /** Invokes the assertion under test. */
  call: () => Promise<void>;
}

export const TENANCY_CASES: readonly TenancyCase[] = [
  {
    name: "project",
    model: "project",
    inOrg: TENANT.project,
    foreign: FOREIGN.project,
    call: () => assertProjectInOrg(db, "id", VALID_ORG_ID),
  },
  {
    name: "board",
    model: "board",
    inOrg: TENANT.board,
    foreign: FOREIGN.board,
    call: () => assertBoardInOrg(db, "id", VALID_ORG_ID),
  },
  {
    name: "column",
    model: "column",
    inOrg: TENANT.column,
    foreign: FOREIGN.column,
    call: () => assertColumnInOrg(db, "id", VALID_ORG_ID),
  },
  {
    name: "task",
    model: "task",
    inOrg: TENANT.task,
    foreign: FOREIGN.task,
    call: () => assertTaskInOrg(db, "id", VALID_ORG_ID),
  },
  {
    name: "label",
    model: "label",
    inOrg: TENANT.label,
    foreign: FOREIGN.label,
    call: () => assertLabelInOrg(db, "id", VALID_ORG_ID),
  },
];
