"use client";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical, Trash2 } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { type JSX } from "react";

import type { Column, Label, Task } from "@taskflow/database";
import { cn, InlineEditText } from "@taskflow/ui";

import { DropdownMenu } from "../common/dropdown-menu";
import { AddTaskButton } from "./add-task-button";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  isOver: boolean;
  isColumnDragging?: boolean;
  onAddTask: (columnId: string, title: string) => void;
  onTaskClick: (task: Task) => void;
  onRenameColumn: (columnId: string, name: string) => void;
  onDeleteColumn: (column: Column) => void;
  assigneeById: Map<string, { name: string | null; email: string }>;
  addingTaskId: string | null; // columnId being added to
  labelsByTask: Record<string, Label[]>;
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
  assigneeById,
}: KanbanColumnProps): JSX.Element {
  // Column-level sortable (for horizontal reorder)
  const {
    attributes,
    listeners,
    setNodeRef: setColumnRef,
    transform,
    transition,
    isDragging: isThisColumnDragging,
  } = useSortable({ id: column.id, data: { type: "column" } });

  const taskIds = tasks.map((t) => t.id);

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
      {/* Column header - drag handle + name + task count */}
      <div className="flex shrink-0 items-center justify-between rounded-md bg-gray-50 px-3 py-2 select-none">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Drag handle for column reorder */}
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
          <InlineEditText
            label={`column name (${column.name})`}
            value={column.name}
            maxLength={100}
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
        </div>
      </div>

      {/* Task list / drop area (covered by the column's sortable droppable) */}
      <div
        data-column-scroll={column.id}
        className={cn(
          "flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto rounded-md p-1 transition-colors",
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
              onClick={() => {
                onTaskClick(task);
              }}
            />
          ))}
        </SortableContext>

        <AddTaskButton
          onAdd={(title) => {
            onAddTask(column.id, title);
          }}
          loading={addingTaskId === column.id}
          taskCount={tasks.length}
        />
      </div>
    </div>
  );
}
