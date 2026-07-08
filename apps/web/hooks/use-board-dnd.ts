"use client";

import type { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";
import type { Column, Task } from "@taskflow/database";
import { arrayMove } from "@dnd-kit/sortable";
import { useState } from "react";

import { calculateNewPosition, getSurroundingPositions } from "@/lib/board/position";

// -- Types --

export type TasksMap = Record<string, Task[]>;

export interface DragHandlers {
  onDragStart: (e: DragStartEvent) => void;
  onDragOver: (e: DragOverEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
}

export interface MovePayload {
  taskId: string;
  sourceColumnId: string;
  targetColumnId: string;
  newPosition: number;
}

interface UseBoardDnDOptions {
  columns: Column[];
  initialTasks: TasksMap;
  onTaskMoved: (payload: MovePayload) => void;
}

interface UseBoardDndResult {
  activeTaskId: string | null;
  localTasks: TasksMap;
  handlers: DragHandlers;
}

/**
 * Encapsulates all drag-and-drop state and logic for the Kanban board.
 *
 * SRP: this hook owns DnD state only — no API calls, no routing.
 * The consuming component (KanbanBoard) decides what to do with `onTaskMoved`.
 *
 * Algorithm:
 * 1. `onDragStart`  — record which task is being dragged.
 * 2. `onDragOver`   — optimistic column reassignment so the UI updates live.
 * 3. `onDragEnd`    — compute final position, commit locally, call `onTaskMoved`.
 */
export function useBoardDnD({
  columns: _columns,
  initialTasks,
  onTaskMoved,
}: UseBoardDnDOptions): UseBoardDndResult {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<TasksMap>(initialTasks);

  /**
   * Sync localTasks when the TanStack Query cache changes externally
   * (e.g. via a Socket.IO event) and no drag is in progress.
   *
   * WHY during-render, not useEffect:
   * Calling setState inside useEffect causes an extra committed render before
   * React can bail out, producing the "cascading renders" warning.
   * The "adjusting state when a prop changes" pattern calls setState during
   * the current render — React immediately discards the half-rendered output,
   * applies both state updates, and produces a single new render.
   * @see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
   */
  const [prevInitialTasks, setPrevInitialTasks] = useState<TasksMap>(initialTasks);
  if (prevInitialTasks !== initialTasks && activeTaskId === null) {
    setPrevInitialTasks(initialTasks);
    setLocalTasks(initialTasks);
  }

  /** Finds which columnId currently owns a given taskId. */
  function findColumnIdForTask(taskId: string): string | null {
    for (const [colId, tasks] of Object.entries(localTasks)) {
      if (tasks.some((t) => t.id === taskId)) return colId;
    }
    return null;
  }

  function onDragStart(e: DragStartEvent): void {
    setActiveTaskId(String(e.active.id));
  }

  /**
   * Optimistically moves the task to the over-column while dragging.
   * Only triggers for cross-column moves to avoid unnecessary re-renders.
   */
  function onDragOver(e: DragOverEvent): void {
    const { active, over } = e;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const sourceColId = findColumnIdForTask(activeId);
    // `over.id` can be a column id or a task id
    const targetColId = overId in localTasks ? overId : findColumnIdForTask(overId);

    if (!sourceColId || !targetColId || sourceColId === targetColId) return;

    setLocalTasks((prev) => {
      const sourceTasks = prev[sourceColId] ?? [];
      const targetTasks = prev[targetColId] ?? [];
      const task = sourceTasks.find((t) => t.id === activeId);
      if (!task) return prev;

      return {
        ...prev,
        [sourceColId]: sourceTasks.filter((t) => t.id !== activeId),
        [targetColId]: [...targetTasks, task],
      };
    });
  }

  function onDragEnd(e: DragEndEvent): void {
    const { active, over } = e;
    setActiveTaskId(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const sourceColId = findColumnIdForTask(activeId);
    const targetColId = overId in localTasks ? overId : findColumnIdForTask(overId);

    if (!sourceColId || !targetColId) return;

    if (sourceColId === targetColId) {
      // Reorder within the same column
      setLocalTasks((prev) => {
        const colTasks = prev[sourceColId] ?? [];
        const oldIndex = colTasks.findIndex((t) => t.id === activeId);
        const newIndex = colTasks.findIndex((t) => t.id === overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;

        const reordered = arrayMove(colTasks, oldIndex, newIndex);
        const positions = colTasks.map((t) => t.position);
        const { prev: prevPos, next: nextPos } = getSurroundingPositions(positions, newIndex);
        const newPosition = calculateNewPosition(prevPos, nextPos);

        onTaskMoved({
          taskId: activeId,
          sourceColumnId: sourceColId,
          targetColumnId: targetColId,
          newPosition,
        });

        return { ...prev, [sourceColId]: reordered };
      });
    } else {
      // Cross-column move - position is appended at the end of target
      const targetTasks = localTasks[targetColId] ?? [];
      const lastPosition = targetTasks[targetTasks.length - 1]?.position ?? 0;
      const newPosition = calculateNewPosition(lastPosition || null, null);

      onTaskMoved({
        taskId: activeId,
        sourceColumnId: sourceColId,
        targetColumnId: targetColId,
        newPosition,
      });
    }
  }

  return {
    activeTaskId,
    localTasks,
    handlers: { onDragStart, onDragOver, onDragEnd },
  };
}
