"use client";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CircleMinus, GripVertical, Trash2 } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { useRef, type JSX } from "react";

import type { Column, Label, Task } from "@taskflow/database";
import { TASK_STATUSES, type SocketPresenceUser, type TaskStatus } from "@taskflow/shared";
import { cn, InlineEditText } from "@taskflow/ui";

import { STATUS_ICONS, STATUS_TEXT_COLORS } from "@/lib/constants/task";
import { useElementSize } from "@/lib/hooks/use-element-size";
import { formatTaskStatus } from "@/lib/utils/task";
import { DropdownMenu } from "../common/dropdown-menu";
import { AddTaskButton } from "./add-task-button";
import { KanbanCard } from "./kanban-card";
import { CursorPointer, shouldFlipCursorLabel, type LiveCursor } from "./kanban-cursors";

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  isOver: boolean;
  isColumnDragging?: boolean;
  onAddTask: (columnId: string, title: string) => void;
  onTaskClick: (task: Task) => void;
  onRenameColumn: (columnId: string, name: string) => void;
  onDeleteColumn: (column: Column) => void;
  onSetColumnStatus: (columnId: string, status: TaskStatus | null) => void;
  assigneeById: Map<string, { name: string | null; email: string | null; isFormer?: boolean }>;
  addingTaskId: string | null; // columnId being added to
  labelsByTask: Record<string, Label[]>;
  /** False for VIEWER - hides rename/delete/add-task/drag, on this column and its cards. */
  canEdit: boolean;
  /** Peer cursors captured over THIS column's own task list (see use-cursor-broadcast.ts). */
  cursors: LiveCursor[];
  presenceById: Map<string, SocketPresenceUser>;
}

/**
 * Droppable column container with a SortableContext for its tasks.
 * Receives tasks and column data from the parent KanbanBoard -
 * no independent data fetching to keep DnD state centralized.
 */
export function KanbanColumn({
  column,
  tasks,
  isOver,
  isColumnDragging = false,
  onAddTask,
  onTaskClick,
  addingTaskId,
  labelsByTask,
  onRenameColumn,
  onDeleteColumn,
  onSetColumnStatus,
  assigneeById,
  canEdit,
  cursors,
  presenceById,
}: KanbanColumnProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { width: scrollWidth } = useElementSize(scrollRef);

  // Column-level sortable (for horizontal reorder)
  const {
    attributes,
    listeners,
    setNodeRef: setColumnRef,
    transform,
    transition,
    isDragging: isThisColumnDragging,
  } = useSortable({ id: column.id, data: { type: "column" }, disabled: !canEdit });

  const taskIds = tasks.map((t) => t.id);
  const StatusIcon = column.mappedStatus ? STATUS_ICONS[column.mappedStatus] : CircleMinus;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setColumnRef}
      style={style}
      data-testid={`column-${column.id}`}
      className={cn(
        "flex max-h-full w-72 shrink-0 flex-col gap-2",
        isThisColumnDragging && "opacity-50",
      )}
    >
      {/* Column header - drag handle, status icon, name, count, menu all on
          one row (Linear/Jira-style: no separate "Status:" row/label - the
          icon shape + color next to the name IS the status). */}
      <div className="flex shrink-0 items-center justify-between rounded-md bg-gray-50 px-3 py-2 select-none">
        <div className="flex items-center gap-1 min-w-0">
          {/* Drag handle for column reorder */}
          {canEdit && (
            <button
              type="button"
              aria-label={`Drag to reorder column: ${column.name}`}
              {...attributes}
              {...listeners}
              className={cn(
                "cursor-grab rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                isColumnDragging && "cursor-grabbing",
              )}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Maps this column to a TaskStatus - creating a task here, or
              dragging one in, then auto-sets Task.status to match (see
              apps/api's tasks/service.ts); setting a mapping also bulk-syncs
              every task already sitting in the column. "No status" leaves a
              column purely organizational (e.g. "Blocked") - moving a task
              there, or clearing an existing mapping, never touches status.
              Icon SHAPE carries the meaning (not just color) - the same
              convention Linear/Jira/Asana use for workflow-state glyphs, so
              it reads correctly before you've learned the color mapping.
              Still a native <select> for free keyboard/a11y support - it's
              just visually collapsed to an invisible layer on top of the
              decorative icon (a standard "icon-triggers-native-select"
              trick), not a custom listbox. */}
          <div
            className={cn(
              "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
              canEdit && "hover:bg-gray-200/70 focus-within:ring-2 focus-within:ring-brand-500",
            )}
            title="Auto-sets task status when a task is created or dropped here"
          >
            <StatusIcon
              aria-hidden="true"
              className={cn(
                "h-3.5 w-3.5",
                column.mappedStatus ? STATUS_TEXT_COLORS[column.mappedStatus] : "text-gray-300",
              )}
            />
            <select
              // Suffixed with the column id, not just its name - column.name
              // has no uniqueness constraint anywhere (schema or addColumn),
              // and "To Do" is literally the default name new columns get,
              // so two same-named columns would otherwise produce identical
              // aria-labels a screen reader (and getByLabelText) can't tell
              // apart. Existing `/status mapping for column to do/i` test
              // matchers still pass - RTL's getByLabelText regex match is a
              // substring match, not an exact one.
              aria-label={`Status mapping for column ${column.name} (${column.id})`}
              disabled={!canEdit}
              value={column.mappedStatus ?? ""}
              onChange={(e) => {
                onSetColumnStatus(column.id, (e.target.value || null) as TaskStatus | null);
              }}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
            >
              <option value="">No status</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatTaskStatus(s)}
                </option>
              ))}
            </select>
          </div>

          <InlineEditText
            label={`column name (${column.name})`}
            value={column.name}
            maxLength={100}
            disabled={!canEdit}
            className="text-xs font-semibold uppercase tracking-wide text-gray-500"
            inputClassName="normal-case"
            onSave={(name) => {
              onRenameColumn(column.id, name);
            }}
          />
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-0.5">
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
            {tasks.length}
          </span>
          {canEdit && (
            <DropdownMenu
              triggerLabel={`Options for column ${column.name}`}
              items={[
                {
                  label: "Delete column",
                  icon: Trash2,
                  danger: true,
                  onClick: () => {
                    onDeleteColumn(column);
                  },
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Task list / drop area (covered by the column's sortable droppable) */}
      <div
        ref={scrollRef}
        data-column-scroll={column.id}
        className={cn(
          "relative flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto rounded-md p-1",
          "transition-colors",
          isOver && "bg-brand-50 ring-1 ring-brand-200",
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              labels={labelsByTask[task.id] ?? []}
              assignee={task.assigneeId ? (assigneeById.get(task.assigneeId) ?? null) : null}
              canEdit={canEdit}
              onClick={() => {
                onTaskClick(task);
              }}
            />
          ))}
        </SortableContext>

        {/* Nested inside the scrollable div itself (not a sibling) so a
            column's own vertical scroll repositions these dots for free -
            mirrors the board-level overlay's horizontal-scroll trick, one
            level deeper. overflow-hidden keeps an off-screen dot from
            inflating this column's own scrollHeight. */}
        <div
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
          aria-hidden="true"
        >
          {cursors.map((c) => (
            <CursorPointer
              key={c.userId}
              cursor={c}
              meta={presenceById.get(c.userId)}
              flip={shouldFlipCursorLabel(c.x, scrollWidth)}
            />
          ))}
        </div>

        {canEdit && (
          <AddTaskButton
            onAdd={(title) => {
              onAddTask(column.id, title);
            }}
            loading={addingTaskId === column.id}
            taskCount={tasks.length}
          />
        )}
      </div>
    </div>
  );
}
