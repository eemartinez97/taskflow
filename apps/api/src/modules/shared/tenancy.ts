import type { PrismaClient } from "@taskflow/database";

import { TRPCError } from "../../trpc/init";

const CROSS_TENANT: ConstructorParameters<typeof TRPCError>[0] = {
  code: "NOT_FOUND",
  // Deliberately NOT_FOUND (not FORBIDDEN): a FORBIDDEN would confirm the
  // resource exists in another tenant.
  message: "Resource not found in this organization.",
};

export async function assertProjectInOrg(
  db: PrismaClient,
  projectId: string,
  orgId: string,
): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });

  if (project?.orgId !== orgId) throw new TRPCError(CROSS_TENANT);
}

export async function assertBoardInOrg(
  db: PrismaClient,
  boardId: string,
  orgId: string,
): Promise<void> {
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { project: { select: { orgId: true } } },
  });

  if (board?.project.orgId !== orgId) throw new TRPCError(CROSS_TENANT);
}

export async function assertColumnInOrg(
  db: PrismaClient,
  columnId: string,
  orgId: string,
): Promise<void> {
  const column = await db.column.findUnique({
    where: { id: columnId },
    select: { board: { select: { project: { select: { orgId: true } } } } },
  });

  if (column?.board.project.orgId !== orgId) throw new TRPCError(CROSS_TENANT);
}

export async function assertTaskInOrg(
  db: PrismaClient,
  taskId: string,
  orgId: string,
): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { column: { select: { board: { select: { project: { select: { orgId: true } } } } } } },
  });

  if (task?.column.board.project.orgId !== orgId) throw new TRPCError(CROSS_TENANT);
}

export async function assertLabelInOrg(
  db: PrismaClient,
  labelId: string,
  orgId: string,
): Promise<void> {
  const label = await db.label.findUnique({ where: { id: labelId }, select: { orgId: true } });

  if (label?.orgId !== orgId) throw new TRPCError(CROSS_TENANT);
}

export async function assertInvitationInOrg(
  db: PrismaClient,
  invitationId: string,
  orgId: string,
): Promise<void> {
  const invitation = await db.invitation.findUnique({
    where: { id: invitationId },
    select: { orgId: true },
  });

  if (invitation?.orgId !== orgId) throw new TRPCError(CROSS_TENANT);
}
