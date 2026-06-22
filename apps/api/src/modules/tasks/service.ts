import type { Server } from "socket.io";
import type { PrismaClient, Task } from "@taskflow/database";
import type { CreateTask, MoveTask, UpdateTask } from "@taskflow/shared";
import { SOCKET_EVENTS, SOCKET_ROOM_PREFIX } from "@taskflow/shared";
import {
  createTask,
  deleteTask,
  findTaskById,
  findTasksByColumn,
  getMaxTaskPosition,
  moveTask,
  updateTask,
} from "./repo.js";
import { TRPCError } from "../../trpc/init.js";
import { notifyTaskAssigned } from "../notifications/service.js";

export async function listTasks(db: PrismaClient, columnId: string): Promise<Task[]> {
  return findTasksByColumn(db, columnId);
}

export async function getTask(db: PrismaClient, taskId: string): Promise<Task> {
  const task = await findTaskById(db, taskId);
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
  return task;
}

export async function createTaskInColumn(
  db: PrismaClient,
  io: Server,
  projectId: string,
  actorId: string,
  data: CreateTask,
): Promise<Task> {
  const position = await getMaxTaskPosition(db, data.columnId);
  const task = await createTask(db, { ...data, position });

  io.to(`${SOCKET_ROOM_PREFIX}${projectId}`).emit(SOCKET_EVENTS.TASK_CREATED, { task });

  await notifyTaskAssigned(db, {
    taskId: task.id,
    taskTitle: task.title,
    assigneeId: task.assigneeId,
    actorId,
  });

  return task;
}

export async function updateTaskById(
  db: PrismaClient,
  io: Server,
  projectId: string,
  actorId: string,
  taskId: string,
  data: UpdateTask,
): Promise<Task> {
  const existing = await getTask(db, taskId);
  const updated = await updateTask(db, taskId, data);

  io.to(`${SOCKET_ROOM_PREFIX}${projectId}`).emit(SOCKET_EVENTS.TASK_UPDATED, { task: updated });

  // Only notify when the assignee actually changed
  const assigneeChanged = data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId;

  if (assigneeChanged) {
    await notifyTaskAssigned(db, {
      taskId: updated.id,
      taskTitle: updated.title,
      assigneeId: updated.assigneeId,
      actorId,
    });
  }

  return updated;
}

export async function moveTaskToColumn(
  db: PrismaClient,
  io: Server,
  projectId: string,
  payload: MoveTask,
): Promise<Task> {
  const task = await moveTask(db, payload);

  io.to(`${SOCKET_ROOM_PREFIX}${projectId}`).emit(SOCKET_EVENTS.TASK_MOVED, { task });

  return task;
}

export async function deleteTaskById(
  db: PrismaClient,
  io: Server,
  projectId: string,
  taskId: string,
): Promise<{ success: boolean }> {
  await getTask(db, taskId);
  await deleteTask(db, taskId);

  io.to(`${SOCKET_ROOM_PREFIX}${projectId}`).emit(SOCKET_EVENTS.TASK_DELETED, { taskId });

  return { success: true };
}
