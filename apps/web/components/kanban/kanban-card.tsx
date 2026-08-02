"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { JSX } from "react";

import type { Label, Task } from "@taskflow/database";
import { Badge, cn } from "@taskflow/ui";

import { PRIORITY_COLORS } from "@/lib/constants/task";
import { GripVertical } from "lucide-react";
import { UserAvatar } from "../common/user-avatar";

interface KanbanCardProps {
  task: Task;
  labels?: Label[];
  assignee?: { name: string | null; email: string } | null;
  isOverlay?: boolean;
  onClick?: () => void;
}

/**
 * Draggable task card.
 *
 * React 19: ref accepted as plain prop - no forwardRef needed.
 * `isOverlay` disables the sortable hook to prevent recursive DnD registration
 * when the card is rendered inside a DragOverlay.
 */
export function KanbanCard({
  task,
  labels = [],
  assignee,
  isOverlay = false,
  onClick,
}: KanbanCardProps): JSX.Element {
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
      role="button"
      tabIndex={0}
      data-testid={`task-card-${task.id}`}
      aria-label={`Open task: ${task.title}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;

        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "cursor-pointer rounded-md border border-gray-200 bg-white p-3 shadow-xs",
        "select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        isDragging && "opacity-40",
        isOverlay && "rotate-1 shadow-md cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation();
          }}
          aria-label={`Move task: ${task.title}`}
          className={cn(
            "cursor-grab touch-none rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            isDragging && "cursor-grabbing",
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-gray-900">{task.title}</p>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-500">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {(task.priority !== "NONE" || assignee) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {task.priority !== "NONE" ? (
            <Badge variant={PRIORITY_COLORS[task.priority]} className="text-xs">
              {task.priority}
            </Badge>
          ) : (
            <span />
          )}
          {assignee && <UserAvatar user={assignee} size="xs" />}
        </div>
      )}
    </div>
  );
}
