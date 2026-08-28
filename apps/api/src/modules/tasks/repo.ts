import {
  POSITION_STEP,
  type CreateTask,
  type MoveTask,
  type TaskStatus,
  type UpdateTask,
} from "@taskflow/shared";
import type { DbClient, Label, PrismaClient, Task } from "@taskflow/database";

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
  data: CreateTask & { position: number; creatorId: string; status?: TaskStatus | undefined },
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

export interface MoveTaskResult {
  task: Task;
  /** Whether this write actually changed the task's status - see below. */
  statusChanged: boolean;
}

/**
 * Moves a task, optionally deriving its status from the target column's
 * mapping. `statusChanged` is computed via a conditional `updateMany`
 * (`status: { not: status }`, same idiom as auth/tokens.ts's
 * consumeEmailVerification) rather than by comparing against a separately
 * pre-fetched "existing" row - that snapshot can go stale across the await
 * gap if a concurrent request changes the same task's status in between,
 * silently mis-firing tasks/service.ts's taskStatusChangesTotal metric. A
 * plain `update()` can't report this either way, since it always succeeds
 * once the row exists regardless of its prior status.
 */
export async function moveTask(
  db: PrismaClient,
  payload: MoveTask & { status?: TaskStatus | undefined },
): Promise<MoveTaskResult> {
  const data = stripUndefined({
    columnId: payload.targetColumnId,
    position: payload.position,
    status: payload.status,
  });

  let statusChanged = false;
  if (payload.status !== undefined) {
    const { count } = await db.task.updateMany({
      where: { id: payload.taskId, status: { not: payload.status } },
      data,
    });
    statusChanged = count > 0;
  }

  // Either no status change was requested, or the task's status already
  // matched the target (updateMany above matched zero rows either way) -
  // still need to apply columnId/position.
  if (!statusChanged) {
    await db.task.update({ where: { id: payload.taskId }, data });
  }

  const task = await db.task.findUniqueOrThrow({ where: { id: payload.taskId } });
  return { task, statusChanged };
}

/**
 * Bulk-syncs every task already in a column to a newly-assigned status, so
 * mapping a column doesn't only affect tasks created/moved AFTER the fact.
 * Returns the ids of tasks actually changed (for the metric increment and
 * the realtime broadcast) - see boards/service.ts's setColumnStatus, which
 * calls this only when the new mapping is non-null (unmapping intentionally
 * leaves existing tasks' status untouched, matching moveTask's own "no
 * mapping -> don't touch status" rule above).
 *
 * Scopes both the read and the write to `status: { not: status }` - tasks
 * already at the target status are excluded from both, so re-mapping a
 * column to the status most of its tasks already hold doesn't inflate the
 * metric with no-op "transitions".
 */
export async function bulkSetTaskStatusForColumn(
  db: DbClient,
  columnId: string,
  status: TaskStatus,
): Promise<string[]> {
  const toChange = await db.task.findMany({
    where: { columnId, status: { not: status } },
    select: { id: true },
  });
  if (toChange.length === 0) return [];

  await db.task.updateMany({
    where: { columnId, status: { not: status } },
    data: { status },
  });

  return toChange.map((t) => t.id);
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
