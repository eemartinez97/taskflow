import type { Label, PrismaClient, Task } from "@taskflow/database";
import { SOCKET_EVENTS, type CreateTask, type MoveTask, type UpdateTask } from "@taskflow/shared";
import {
  attachLabelToTask,
  createTask,
  deleteTask,
  detachLabelFromTask,
  findLabelsByTask,
  findTaskById,
  findTaskByUser,
  findTaskLabelsByProject,
  findTasksByColumn,
  getMaxTaskPosition,
  moveTask,
  updateTask,
  type TaskWithProject,
} from "./repo";
import { TRPCError } from "../../trpc/init";
import { notifyTaskAssigned } from "../notifications/service";
import type { AppServer } from "../../socket/events";
import { emitToProject } from "../../socket/emit";

export async function listTasks(db: PrismaClient, columnId: string): Promise<Task[]> {
  return findTasksByColumn(db, columnId);
}

export async function getTask(db: PrismaClient, taskId: string): Promise<Task> {
  const task = await findTaskById(db, taskId);
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
  return task;
}

export async function getMyTasks(db: PrismaClient, userId: string): Promise<TaskWithProject[]> {
  return findTaskByUser(db, userId);
}

export async function createTaskInColumn(
  db: PrismaClient,
  io: AppServer,
  projectId: string,
  actorId: string,
  data: CreateTask,
): Promise<Task> {
  const position = await getMaxTaskPosition(db, data.columnId);
  const task = await createTask(db, { ...data, position, creatorId: actorId });

  emitToProject(io, projectId, SOCKET_EVENTS.TASK_CREATED, { task });

  await notifyTaskAssigned(db, io, {
    taskId: task.id,
    taskTitle: task.title,
    assigneeId: task.assigneeId,
    creatorId: task.creatorId,
    actorId,
  });

  return task;
}

export async function updateTaskById(
  db: PrismaClient,
  io: AppServer,
  projectId: string,
  actorId: string,
  taskId: string,
  data: UpdateTask,
): Promise<Task> {
  const existing = await getTask(db, taskId);
  const updated = await updateTask(db, taskId, data);

  emitToProject(io, projectId, SOCKET_EVENTS.TASK_UPDATED, { task: updated });

  // Only notify when the assignee actually changed
  const assigneeChanged = data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId;

  if (assigneeChanged) {
    await notifyTaskAssigned(db, io, {
      taskId: updated.id,
      taskTitle: updated.title,
      assigneeId: updated.assigneeId,
      creatorId: updated.creatorId,
      actorId,
    });
  }

  return updated;
}

export async function moveTaskToColumn(
  db: PrismaClient,
  io: AppServer,
  projectId: string,
  payload: MoveTask,
): Promise<Task> {
  const task = await moveTask(db, payload);

  emitToProject(io, projectId, SOCKET_EVENTS.TASK_MOVED, { task });

  return task;
}

export async function deleteTaskById(
  db: PrismaClient,
  io: AppServer,
  projectId: string,
  taskId: string,
): Promise<{ success: true }> {
  await getTask(db, taskId);
  await deleteTask(db, taskId);

  emitToProject(io, projectId, SOCKET_EVENTS.TASK_DELETED, { taskId });

  return { success: true };
}

// -- Task labels --

export interface TaskLabelInput {
  orgId: string;
  projectId: string;
  taskId: string;
  labelId: string;
}

export async function listTaskLabels(db: PrismaClient, taskId: string): Promise<Label[]> {
  return findLabelsByTask(db, taskId);
}

export async function listProjectTaskLabels(
  db: PrismaClient,
  projectId: string,
): Promise<{ taskId: string; label: Label }[]> {
  return findTaskLabelsByProject(db, projectId);
}

/** Reads the fresh label list, broadcasts it to the project room, returns it. */
async function emitLabelsChanged(
  db: PrismaClient,
  io: AppServer,
  projectId: string,
  taskId: string,
): Promise<Label[]> {
  const labels = await findLabelsByTask(db, taskId);

  emitToProject(io, projectId, SOCKET_EVENTS.TASK_LABELS_CHANGED, { taskId, labels });

  return labels;
}

export async function addLabelToTaskById(
  db: PrismaClient,
  io: AppServer,
  input: TaskLabelInput,
): Promise<Label[]> {
  await getTask(db, input.taskId); // NOT_FOUND when the task doesn't exist

  const label = await db.label.findUnique({ where: { id: input.labelId } });
  if (label?.orgId !== input.orgId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Label not found." });
  }

  await attachLabelToTask(db, input.taskId, input.labelId);
  return emitLabelsChanged(db, io, input.projectId, input.taskId);
}

export async function removeLabelFromTaskById(
  db: PrismaClient,
  io: AppServer,
  input: TaskLabelInput,
): Promise<Label[]> {
  await detachLabelFromTask(db, input.taskId, input.labelId);

  return emitLabelsChanged(db, io, input.projectId, input.taskId);
}
