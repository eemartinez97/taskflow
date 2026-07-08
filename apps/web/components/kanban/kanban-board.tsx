"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState, type JSX } from "react";

import type { Column, Task } from "@taskflow/database";

import { useBoardDnD, type TasksMap } from "@/hooks/use-board-dnd";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { api } from "@/lib/trpc/client";

interface KanbanBoardProps {
  orgId: string;
  projectId: string;
  columns: Column[];
  /** Initial tasks keyed by columnId - populated by the server prefetch */
  initialTasks: TasksMap;
}

/**
 * Kanban board with cross-column drag-and-drop.
 *
 * Architecture:
 * - useBoardDnD owns all DnD state and optimistic local updates
 * - KanbanColumn renders each column's sorted tasks
 * - KanbanCard is the individual draggable task
 * - tRPC mutation commits the move to the server
 */
export function KanbanBoard({
  orgId,
  projectId,
  columns,
  initialTasks,
}: KanbanBoardProps): JSX.Element {
  const [overId, setOverId] = useState<string | null>(null);

  const moveMutation = api.tasks.move.useMutation();

  const { activeTaskId, localTasks, handlers } = useBoardDnD({
    columns,
    initialTasks,
    onTaskMoved: ({ taskId, targetColumnId, newPosition }) => {
      moveMutation.mutate({
        orgId,
        projectId,
        payload: { taskId, targetColumnId, position: newPosition },
      });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** Finds the active task from localTasks for DragOverlay rendering */
  function findActiveTask(): Task | null {
    // TODO: al parecer esta logica se repite
    if (!activeTaskId) return null;
    for (const tasks of Object.values(localTasks)) {
      const found = tasks.find((t) => t.id === activeTaskId);
      if (found) return found;
    }
    return null;
  }

  function handleDragOver(e: DragOverEvent): void {
    setOverId(e.over ? String(e.over.id) : null);
    handlers.onDragOver(e);
  }

  function handleDragEnd(e: Parameters<typeof handlers.onDragEnd>[0]): void {
    setOverId(null);
    handlers.onDragEnd(e);
  }

  const activeTask = findActiveTask();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handlers.onDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        data-testid="kanban-board"
        className="flex gap-4 overflow-x-auto pb-4"
        role="region"
        aria-label="Kanban board"
      >
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={localTasks[column.id] ?? []}
            isOver={overId === column.id}
          />
        ))}
      </div>

      <DragOverlay>{activeTask ? <KanbanCard task={activeTask} isOverlay /> : null}</DragOverlay>
    </DndContext>
  );
}
