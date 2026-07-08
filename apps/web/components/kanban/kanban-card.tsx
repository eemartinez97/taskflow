"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { JSX } from "react";

import type { Task } from "@taskflow/database";
import { Badge, cn } from "@taskflow/ui";

interface KanbanCardProps {
  task: Task;
  isOverlay?: boolean;
}

const PRIORITY_COLORS = {
  NONE: "outline",
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "destructive",
  URGENT: "destructive",
} as const satisfies Record<Task["priority"], "outline" | "success" | "warning" | "destructive">;

/**
 * Draggable task card.
 *
 * React 19: ref accepted as plain prop — no forwardRef needed.
 * `isOverlay` disables the sortable hook to prevent recursive DnD registration
 * when the card is rendered inside a DragOverlay.
 */
export function KanbanCard({ task, isOverlay = false }: KanbanCardProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`task-card-${task.id}`}
      className={cn(
        "cursor-grab rounded-md border border-gray-200 bg-white p-3 shadow-xs",
        "select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        isDragging && "opacity-40",
        isOverlay && "rotate-1 shadow-md cursor-grabbing",
      )}
    >
      <p className="text-sm font-medium text-gray-900 leading-snug">{task.title}</p>

      {task.priority !== "NONE" && (
        <div className="mt-2">
          <Badge variant={PRIORITY_COLORS[task.priority]} className="text-xs">
            {task.priority}
          </Badge>
        </div>
      )}
    </div>
  );
}
