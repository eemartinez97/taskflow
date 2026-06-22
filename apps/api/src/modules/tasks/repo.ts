import type { PrismaClient, Task } from "@taskflow/database";
import type { CreateTask, MoveTask, UpdateTask } from "@taskflow/shared";
import { POSITION_STEP } from "@taskflow/shared";
import { stripUndefined } from "../../utils/prisma.js";

export async function findTasksByColumn(db: PrismaClient, columnId: string): Promise<Task[]> {
  return db.task.findMany({
    where: { columnId },
    orderBy: { position: "asc" },
  });
}

export async function findTaskById(db: PrismaClient, taskId: string): Promise<Task | null> {
  return db.task.findUnique({ where: { id: taskId } });
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
  data: CreateTask & { position: number },
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
