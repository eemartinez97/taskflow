/**
 * Task-display helpers.
 *
 * Single source of truth for formatting the enum-like TASK_STATUSES values
 * ("IN_PROGRESS" -> "IN PROGRESS") - previously duplicated inline in
 * TasksClient and TaskDetailPanel.
 *
 * Uses `replaceAll` (not `replace`) because `replace` only touches the
 * FIRST underscore, which would break any future multi-word status.
 */
export function formatTaskStatus(status: string): string {
  return status.replaceAll("_", " ");
}
