"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { JSX } from "react";

import type { Column, Task } from "@taskflow/database";
import { cn } from "@taskflow/ui";

import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  isOver: boolean;
}

/**
 * Droppable column container with a SortableContext for its tasks.
 * Receives tasks and column data from the parent KanbanBoard —
 * no independent data fetching to keep DnD state centralised.
 */
export function KanbanColumn({ column, tasks, isOver }: KanbanColumnProps): JSX.Element {
  const { setNodeRef } = useDroppable({ id: column.id });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div data-testid={`column-${column.id}`} className="flex w-72 flex-shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {column.name}
        </span>
        <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
          {tasks.length}
        </span>
      </div>

      {/* Droppable + sortable task list */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-md p-1 transition-colors min-h-[80px]",
          isOver && "bg-brand-50 ring-1 ring-brand-200",
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
