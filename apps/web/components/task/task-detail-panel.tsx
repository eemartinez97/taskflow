"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { X, Trash2 } from "lucide-react";

import {
  updateTaskSchema,
  type UpdateTask,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@taskflow/shared";
import { Button, cn, FormField, Input, Select } from "@taskflow/ui";
import type { Label, Task } from "@taskflow/database";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { TaskComments } from "./task-comments";
import { displayName } from "@/lib/utils/user";
import { TaskLabels } from "./task-labels";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { emptyStringToNull, selectValueToNull } from "@/lib/utils/form";
import { registerDirtyCheck } from "@/lib/utils/navigation-guard";
import { formatTaskStatus } from "@/lib/utils/task";

interface TaskDetailPanelProps {
  task: Task;
  orgId: string;
  projectId: string;
  onClose: () => void;
}

/**
 * Slide-over panel showing full task details.
 * Covers: tasks.get, tasks.update, tasks.delete, comments.list/create/delete.
 *
 * Labels are managed inline via <TaskLabels />, persisted through the
 * tasks.addLabel / tasks.removeLabel mutations; both return the fresh
 * Label[] which is written straight into the tasks.labels cache.
 */

export function TaskDetailPanel({
  task,
  orgId,
  projectId,
  onClose,
}: TaskDetailPanelProps): JSX.Element {
  const utils = api.useUtils();
  const deleteDialog = useDisclosure();
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  // Fetch full task detail
  const { data: fullTask } = api.tasks.get.useQuery(
    { orgId, taskId: task.id },
    { initialData: task },
  );

  // Fetch org members for the assignee picker
  const membersQuery = api.orgs.members.useQuery({ orgId });
  const members = membersQuery.data ?? [];

  // A task can still be assigned to someone who has since left/been removed
  // (attribution is preserved on purpose - see apps/api's
  // removeMembershipAndNotify). Without this, the select has no <option> for
  // that value and silently shows blank, contradicting what the DB says.
  const { data: formerAssignees = [] } = api.orgs.formerAssignees.useQuery({ orgId });
  const assignedFormerMember =
    fullTask.assigneeId && !members.some((m) => m.user.id === fullTask.assigneeId)
      ? formerAssignees.find((u) => u.id === fullTask.assigneeId)
      : undefined;

  const { data: orgLabels = [] } = api.labels.list.useQuery({ orgId });
  const { data: taskLabels = [] } = api.tasks.labels.useQuery({ orgId, taskId: task.id });

  // Both mutations return the fresh Label[] - write it straight into the
  // panel cache and the board's project-wide chips map (same shape
  // onTaskLabelsChanged's socket handler writes - see
  // use-board-realtime.ts), which the server excludes the acting user's
  // own socket from receiving for exactly this reason (see
  // socket/emit.ts's excludeUserId).
  const syncLabels = (labels: Label[]): void => {
    utils.tasks.labels.setData({ orgId, taskId: task.id }, labels);
    utils.tasks.labelsByProject.setData({ orgId, projectId }, (prev) => [
      ...(prev ?? []).filter((pair) => pair.taskId !== task.id),
      ...labels.map((label) => ({ taskId: task.id, label })),
    ]);
  };

  const addLabelMutation = api.tasks.addLabel.useMutation({ onSuccess: syncLabels });
  const removeLabelMutation = api.tasks.removeLabel.useMutation({ onSuccess: syncLabels });

  const updateMutation = api.tasks.update.useMutation({
    onSuccess: (updated) => {
      toast.success("Task saved.");
      utils.tasks.list.setData({ orgId, columnId: updated.columnId }, (prev) =>
        (prev ?? []).map((t) => (t.id === updated.id ? updated : t)),
      );
      // Keep the panel's own query and the /tasks page in sync
      utils.tasks.get.setData({ orgId, taskId: updated.id }, updated);
      void utils.tasks.myTasks.invalidate();
    },
  });

  const deleteMutation = api.tasks.delete.useMutation({
    onSuccess: () => {
      toast.success("Task deleted.");
      utils.tasks.list.setData({ orgId, columnId: task.columnId }, (prev) =>
        (prev ?? []).filter((t) => t.id !== task.id),
      );
      void utils.tasks.myTasks.invalidate();
      onClose();
    },
  });

  const { register, handleSubmit, reset, formState } = useForm<UpdateTask>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: fullTask.title,
      description: fullTask.description ?? undefined,
      priority: fullTask.priority,
      status: fullTask.status,
      assigneeId: fullTask.assigneeId ?? undefined,
    },
  });

  // Lets the org switcher warn before navigating away while this field has
  // in-progress, not-yet-blurred edits (autosave only fires on blur/select).
  useEffect(() => {
    return registerDirtyCheck(() => formState.isDirty);
  }, [formState.isDirty]);

  // Re-init ONLY when a DIFFERENT task opens. Depending on the full object
  // would clobber in-progress edits every time an autosave response lands
  // (onSuccess writes tasks.get -> new fullTask identity -> reset()).
  useEffect(() => {
    reset({
      title: fullTask.title,
      description: fullTask.description ?? undefined,
      priority: fullTask.priority,
      status: fullTask.status,
      assigneeId: fullTask.assigneeId ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullTask.id, reset]);

  function onSubmit(data: UpdateTask): void {
    // Autosave guard: skip no-op saves (blur without changes, re-selecting
    // the same option). Compares against the freshest server copy.
    const unchanged =
      data.title === fullTask.title &&
      (data.description ?? null) === (fullTask.description ?? null) &&
      data.priority === fullTask.priority &&
      data.status === fullTask.status &&
      (data.assigneeId ?? null) === (fullTask.assigneeId ?? null);

    if (unchanged) return;

    updateMutation.mutate({ orgId, projectId, taskId: task.id, data });
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" aria-hidden="true" onClick={onClose} />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Task details"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col
                   border-l border-gray-200 bg-white shadow-xl overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 shrink-0">
          <div className="flex min-w-0 items-baseline gap-2 pr-4">
            <h2 className="text-base font-semibold text-gray-900 truncate">Task details</h2>
            <span aria-live="polite" className="shrink-0 text-xs text-gray-400">
              {updateMutation.isPending ? "Saving…" : updateMutation.isSuccess ? "Saved" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete task"
              onClick={deleteDialog.open}
              className="text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close panel"
              onClick={onClose}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
          <div className={cn("flex flex-col gap-6", commentsExpanded && "hidden")}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              onChange={(e) => {
                if ((e.target as HTMLElement).tagName === "SELECT") {
                  void handleSubmit(onSubmit)();
                }
              }}
              onBlur={(e) => {
                const tag = (e.target as HTMLElement).tagName;
                if (tag === "INPUT" || tag === "TEXTAREA") {
                  void handleSubmit(onSubmit)();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                  e.preventDefault();
                  void handleSubmit(onSubmit)();
                }
              }}
              className="flex flex-col gap-4"
            >
              <FormField label="Title" htmlFor="task-title">
                <Input id="task-title" {...register("title")} />
              </FormField>

              <FormField label="Description" htmlFor="task-description">
                <textarea
                  id="task-description"
                  rows={4}
                  {...register("description", { setValueAs: emptyStringToNull })}

                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                resize-none"
                  placeholder="Add a description…"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Priority" htmlFor="task-priority">
                  <Select id="task-priority" {...register("priority")}>
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Status" htmlFor="task-status">
                  <Select id="task-status" {...register("status")}>
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {formatTaskStatus(s)}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <FormField label="Assignee" htmlFor="task-assignee">
                {membersQuery.isPending ? (
                  <p className="text-xs text-gray-400">Loading members…</p>
                ) : (
                  <Select
                    id="task-assignee"
                    {...register("assigneeId", { setValueAs: selectValueToNull })}
                  >
                    <option value="">Unassigned</option>
                    {assignedFormerMember && (
                      <option value={assignedFormerMember.id} disabled>
                        {displayName(assignedFormerMember)} · ex
                      </option>
                    )}
                    {members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {displayName(m.user)}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </form>

            <TaskLabels
              orgLabels={orgLabels}
              taskLabelIds={taskLabels.map((l) => l.id)}
              onAdd={(labelId) => {
                addLabelMutation.mutate({ orgId, projectId, taskId: task.id, labelId });
              }}
              onRemove={(labelId) => {
                removeLabelMutation.mutate({ orgId, projectId, taskId: task.id, labelId });
              }}
            />
          </div>

          {/* Comments */}
          <div
            className={
              commentsExpanded ? "flex min-h-0 flex-1 flex-col" : "flex h-96 min-h-0 flex-col"
            }
          >
            <TaskComments
              orgId={orgId}
              projectId={projectId}
              taskId={task.id}
              isExpanded={commentsExpanded}
              onToggleExpand={() => {
                setCommentsExpanded((prev) => !prev);
              }}
            />
          </div>
        </div>
      </aside>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        onConfirm={() => {
          deleteMutation.mutate({ orgId, projectId, taskId: task.id });
        }}
        title="Delete task"
        description={`Delete "${task.title}"? This action cannot be undone.`}
        confirmLabel="Delete task"
        loading={deleteMutation.isPending}
        danger
      />
    </>
  );
}
