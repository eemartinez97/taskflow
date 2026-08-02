import type { Task } from "@taskflow/database";

/**
 * Map of columnId -> ordered tasks. Single source of truth for the board's
 * client-side state shape (previously declared inside use-board-dnd).
 */
export type TasksMap = Record<string, Task[]>;

/**
 * Returns the task with `taskId` wherever it lives in the map, or null.
 */
export function findTaskInMap(tasksMap: TasksMap, taskId: string): Task | null {
  for (const tasks of Object.values(tasksMap)) {
    const found = tasks.find((t) => t.id === taskId);
    if (found) return found;
  }
  return null;
}

/** Returns the columnId currently owning `taskId`, or null */
export function findColumnIdForTask(tasksMap: TasksMap, taskId: string): string | null {
  for (const [columnId, tasks] of Object.entries(tasksMap)) {
    if (tasks.some((t) => t.id === taskId)) return columnId;
  }
  return null;
}
