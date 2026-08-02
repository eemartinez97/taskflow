import { POSITION_STEP, type CreateTask, type MoveTask, type UpdateTask } from "@taskflow/shared";
import type { Label, PrismaClient, Task } from "@taskflow/database";

import { stripUndefined } from "../../utils/prisma";

/**
 * Task enriched with its project/org ids (flattened relation chain
 * task -> column -> board -> project).
 *
 * WHY: the web "My Tasks" view opens a detail panel whose mutations
 * (tasks.update / tasks.delete / comments.create) require real orgId and
 * projectId. `Task` alone does not carry them and the client cannot derive
 * them, so this list endpoint flattens the two ids into each row instead of
 * leaking a nested Prisma include across the API boundary.
 *
 * NOTE: relation names (`column`, `board`, `project`) must match
 * schema.prisma - adjust here if your schema names them differently.
 */
export interface TaskWithProject extends Task {
  projectId: string;
  orgId: string;
}

export async function findTasksByColumn(db: PrismaClient, columnId: string): Promise<Task[]> {
  return db.task.findMany({
    where: { columnId },
    orderBy: { position: "asc" },
  });
}

export async function findTaskById(db: PrismaClient, taskId: string): Promise<Task | null> {
  return db.task.findUnique({ where: { id: taskId } });
}

export async function findTaskByUser(db: PrismaClient, userId: string): Promise<TaskWithProject[]> {
  const tasks = await db.task.findMany({
    where: { assigneeId: userId },
    orderBy: { updatedAt: "desc" },
    include: {
      column: {
        select: {
          board: {
            select: {
              projectId: true,
              project: { select: { orgId: true } },
            },
          },
        },
      },
    },
  });

  // Flatten the relation chain so clients receive a plain Task + ids
  return tasks.map(({ column, ...task }) => ({
    ...task,
    projectId: column.board.projectId,
    orgId: column.board.project.orgId,
  }));
}

export async function getMaxTaskPosition(db: PrismaClient, columnId: string): Promise<number> {
  const last = await db.task.findFirst({
    where: { columnId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  return (last?.position ?? 0) + POSITION_STEP;
}

export async function createTask(
  db: PrismaClient,
  data: CreateTask & { position: number; creatorId: string },
): Promise<Task> {
  return db.task.create({ data: stripUndefined(data) });
}

export async function updateTask(
  db: PrismaClient,
  taskId: string,
  data: UpdateTask,
): Promise<Task> {
  return db.task.update({ where: { id: taskId }, data: stripUndefined(data) });
}

export async function moveTask(db: PrismaClient, payload: MoveTask): Promise<Task> {
  return db.task.update({
    where: { id: payload.taskId },
    data: {
      columnId: payload.targetColumnId,
      position: payload.position,
    },
  });
}

export async function deleteTask(db: PrismaClient, taskId: string): Promise<void> {
  await db.task.delete({ where: { id: taskId } });
}

/** All labels attached to a task, ordered by name. */
export async function findLabelsByTask(db: PrismaClient, taskId: string): Promise<Label[]> {
  return db.label.findMany({
    where: { tasks: { some: { taskId } } },
    orderBy: { name: "asc" },
  });
}

/** Every (task, label) pair for a project 0 the board uses it for card chips. */
export async function findTaskLabelsByProject(
  db: PrismaClient,
  projectId: string,
): Promise<{ taskId: string; label: Label }[]> {
  const rows = await db.taskLabel.findMany({
    where: { task: { column: { board: { projectId } } } },
    include: { label: true },
  });

  return rows.map(({ taskId, label }) => ({ taskId, label }));
}

/** Idempotent attach - upsert on the composite PK so re-adding is a no-op. */
export async function attachLabelToTask(
  db: PrismaClient,
  taskId: string,
  labelId: string,
): Promise<void> {
  await db.taskLabel.upsert({
    where: { taskId_labelId: { taskId, labelId } },
    create: { taskId, labelId },
    update: {},
  });
}

/** Idempotent detach - deleteMany never throws when the pair is absent. */
export async function detachLabelFromTask(
  db: PrismaClient,
  taskId: string,
  labelId: string,
): Promise<void> {
  await db.taskLabel.deleteMany({ where: { taskId, labelId } });
}
