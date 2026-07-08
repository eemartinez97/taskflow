import type { SocketTask } from "@taskflow/shared";

/**
 * Pure cache-update helpers for task lists stored in TanStack Query.
 *
 * WHY pure functions (not methods on a class):
 * - Trivially testable with no mocks.
 * - SRP: each function does exactly one thing.
 * - Composable by the `useBoardRealtime` hook.
 *
 * The updater signature `(prev: T[] | undefined) => T[]` matches
 * what `api.tasks.list.setData(input, updater)` expects in tRPC v11.
 */

/** Inserts a task or replaces the existing entry with the same id. */
export function upsertTask(prev: SocketTask[] | undefined, task: SocketTask): SocketTask[] {
  const existing = prev ?? [];
  const idx = existing.findIndex((t) => t.id === task.id);
  if (idx === -1) return [...existing, task];
  return [...existing.slice(0, idx), task, ...existing.slice(idx + 1)];
}

/** Removes a task by id from a list. Returns the unchanged list when not found */
export function removeTask(prev: SocketTask[] | undefined, taskId: string): SocketTask[] {
  return (prev ?? []).filter((t) => t.id !== taskId);
}

/**
 * Moves a task to a new column by removing it from wherever it currently
 * exists and inserting it into the target column.
 *
 * The function returns a NEW TasksMap (never mutates) so TanStack Query
 * can correctly detect the reference change.
 *
 * @param tasksMap  - Current map of { columnId → tasks[] }
 * @param task      - Updated task with the new `columnId` set by the server
 * @param columnIds - All column ids in the board (needed for exhaustive search)
 */
export function applyTaskMove(
  tasksMap: Record<string, SocketTask[]>,
  task: SocketTask,
  columnIds: string[],
): Record<string, SocketTask[]> {
  const result: Record<string, SocketTask[]> = { ...tasksMap };

  // 1. Remove from every column (we don't know the source column from the event)
  for (const colId of columnIds) {
    const tasks = result[colId];
    if (tasks) result[colId] = removeTask(tasks, task.id);
  }

  // 2. Insert into the target column at the correct position
  const targetTasks = result[task.columnId] ?? [];
  const insertedSorted = [...targetTasks, task].sort((a, b) => a.position - b.position);
  result[task.columnId] = insertedSorted;

  return result;
}
