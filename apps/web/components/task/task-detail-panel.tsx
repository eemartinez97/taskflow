"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { X, Trash2 } from "lucide-react";

import { updateTaskSchema, type UpdateTask, TASK_PRIORITIES } from "@taskflow/shared";
import { Button, cn, FormField, Input, Select } from "@taskflow/ui";
import type { Label, Task } from "@taskflow/database";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useAssigneeLookup } from "@/lib/hooks/use-assignee-lookup";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { useTaskComments } from "@/lib/hooks/use-task-comments";
import { TaskCommentsList } from "./task-comments-list";
import { TaskCommentComposer } from "./task-comment-composer";
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
  /** False for VIEWER - every field/action here becomes read-only. */
  canEdit: boolean;
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
  canEdit,
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

  // Fetch org members + ex-members for the assignee picker. A task can still
  // be assigned to someone who has since left/been removed (attribution is
  // preserved on purpose - see apps/api's removeMembershipAndNotify);
  // without assigneeById covering both groups, the select would have no
  // <option> for that value while its own query is still pending, and the
  // browser's default-to-first-option behavior plus this form's
  // autosave-on-change could silently persist that as "Unassigned".
  const { members, assigneeById, isPending: assigneesPending } = useAssigneeLookup(orgId);
  const assignee = fullTask.assigneeId ? assigneeById.get(fullTask.assigneeId) : undefined;
  const assignedFormerMember = assignee?.isFormer ? assignee : undefined;

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

  // Comments feature state - shared between TaskCommentsList (scrollable,
  // rendered inline below) and TaskCommentComposer (pinned in the fixed
  // footer, always visible - see use-task-comments.ts's docblock).
  const comments = useTaskComments({ orgId, projectId, taskId: task.id });

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
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 shrink-0">
          <div className="flex min-w-0 items-center gap-2 pr-4">
            <h2 className="text-base font-semibold text-gray-900 truncate">Task details</h2>
            {/* Status is derived from the task's column (see apps/api's
                tasks/service.ts createTaskInColumn/moveTaskToColumn) - drag
                the task to a different column to change it. Shown here as a
                compact pill instead of a full-height field in the form below
                to keep the settings section short and leave more room for
                comments. */}
            <span
              className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium
                         text-gray-600"
            >
              {formatTaskStatus(fullTask.status)}
            </span>
            <span aria-live="polite" className="shrink-0 text-xs text-gray-400">
              {updateMutation.isPending ? "Saving…" : updateMutation.isSuccess ? "Saved" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete task"
                onClick={deleteDialog.open}
                className="text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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

        {/* Settings - fixed in place, never scrolls. Hidden entirely (not
            just visually) while comments are expanded, so the comments
            section below gets the full body instead. */}
        <div className={cn("shrink-0 px-5 py-4", commentsExpanded && "hidden")}>
          <div className="flex flex-col gap-5">
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
              className="flex flex-col gap-3.5"
            >
              <FormField label="Title" htmlFor="task-title">
                <Input id="task-title" className="h-8" disabled={!canEdit} {...register("title")} />
              </FormField>

              <FormField label="Description" htmlFor="task-description">
                <textarea
                  id="task-description"
                  rows={3}
                  disabled={!canEdit}
                  {...register("description", { setValueAs: emptyStringToNull })}

                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                resize-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Add a description…"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Priority" htmlFor="task-priority">
                  <Select
                    id="task-priority"
                    className="h-8 py-1"
                    disabled={!canEdit}
                    {...register("priority")}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Assignee" htmlFor="task-assignee">
                  {assigneesPending ? (
                    <p className="text-xs text-gray-400">Loading members…</p>
                  ) : (
                    <Select
                      id="task-assignee"
                      className="h-8 py-1"
                      disabled={!canEdit}
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
              </div>
            </form>

            <TaskLabels
              orgLabels={orgLabels}
              taskLabelIds={taskLabels.map((l) => l.id)}
              canEdit={canEdit}
              onAdd={(labelId) => {
                addLabelMutation.mutate({ orgId, projectId, taskId: task.id, labelId });
              }}
              onRemove={(labelId) => {
                removeLabelMutation.mutate({ orgId, projectId, taskId: task.id, labelId });
              }}
            />
          </div>
        </div>

        {/* Comments - the Slack/Linear "message pane" pattern: this region
            always fills whatever vertical space is left below settings (or
            below the header alone, once settings are hidden via expand -
            the toggle exists to give a long thread more room to read, not
            to change how the sizing works). The list is the only thing
            that scrolls (task-comments-list.tsx's own min-h-0 flex-1 +
            overflow-y-auto); the composer is a shrink-0 sibling pinned
            right below it, always reachable without scrolling. Settings
            above are a separate, ordinary block and never scroll at all -
            each region owns exactly the scroll behavior it needs, instead
            of one shared scroll container for everything. */}
        <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-3">
          <TaskCommentsList
            comments={comments.comments}
            isPending={comments.isPending}
            sessionUserId={comments.sessionUserId}
            isExpanded={commentsExpanded}
            canEdit={canEdit}
            onToggleExpand={() => {
              setCommentsExpanded((prev) => !prev);
            }}
            onDelete={comments.deleteComment}
          />

          {canEdit && (
            <div className="shrink-0 border-t border-gray-200">
              <TaskCommentComposer
                body={comments.body}
                setBody={comments.setBody}
                submit={comments.submit}
                notifyTyping={comments.notifyTyping}
                typingUserIds={comments.typingUserIds}
                isPosting={comments.isPosting}
              />
            </div>
          )}
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
