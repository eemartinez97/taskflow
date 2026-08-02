"use client";

import type { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useState } from "react";

import { type TasksMap, findColumnIdForTask } from "@/lib/board/tasks-map";
import { calculateNewPosition } from "@/lib/board/position";

// -- Types --
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
 * SRP: this hook owns DnD state only - no API calls, no routing.
 * The consuming component (KanbanBoard) decides what to do with `onTaskMoved`.
 *
 * Algorithm:
 * 1. `onDragStart`  - record which task is being dragged.
 * 2. `onDragOver`   - optimistic column reassignment so the UI updates live.
 * 3. `onDragEnd`    - compute final position, commit locally, call `onTaskMoved`.
 */
export function useBoardDnD({ initialTasks, onTaskMoved }: UseBoardDnDOptions): UseBoardDndResult {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<TasksMap>(initialTasks);
  /** Column the task lived in when the drag STARTED (before onDragOver moves it). */
  const [originColumnId, setOriginColumnId] = useState<string | null>(null);

  /**
   * Sync localTasks when the TanStack Query cache changes externally
   * (e.g. via a Socket.IO event) and no drag is in progress.
   *
   * WHY during-render, not useEffect:
   * Calling setState inside useEffect causes an extra committed render before
   * React can bail out, producing the "cascading renders" warning.
   * The "adjusting state when a prop changes" pattern calls setState during
   * the current render - React immediately discards the half-rendered output,
   * applies both state updates, and produces a single new render.
   * @see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
   */
  const [prevInitialTasks, setPrevInitialTasks] = useState<TasksMap>(initialTasks);
  if (prevInitialTasks !== initialTasks && activeTaskId === null) {
    setPrevInitialTasks(initialTasks);
    setLocalTasks(initialTasks);
  }

  function onDragStart(e: DragStartEvent): void {
    const id = String(e.active.id);
    setActiveTaskId(id);
    setOriginColumnId(findColumnIdForTask(localTasks, id));
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

    const sourceColId = findColumnIdForTask(localTasks, activeId);
    // `over.id` can be a column id or a task id
    const targetColId = overId in localTasks ? overId : findColumnIdForTask(localTasks, overId);

    if (!sourceColId || !targetColId || sourceColId === targetColId) return;

    setLocalTasks((prev) => {
      /* v8 ignore start -- sourceColId/targetColId were derived from this exact `prev` state moments ago */
      const sourceTasks = prev[sourceColId] ?? [];
      const targetTasks = prev[targetColId] ?? [];
      /* v8 ignore end */
      const task = sourceTasks.find((t) => t.id === activeId);
      /* v8 ignore next -- activeId was found in this exact column moments ago */
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
    const sourceColId = originColumnId; // real origin, captured at drag start

    setActiveTaskId(null);
    setOriginColumnId(null);

    if (!over || !sourceColId) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // `over.id` can be a column id or a task id
    const targetColId = overId in localTasks ? overId : findColumnIdForTask(localTasks, overId);
    if (!targetColId) return;

    const targetTasks = localTasks[targetColId] ?? [];
    const currentIndex = targetTasks.findIndex((t) => t.id === activeId);
    const columnChanged = sourceColId !== targetColId;

    if (currentIndex !== -1) {
      // Normal path: the task is already in the target column (it never left,
      // or onDragOver relocated it optimistically).
      // Dropping over the column background (overId === column id) keeps the
      // current index instead of bailing out - the old `newIndex === -1 =>
      // return` silently reverted every drop onto an empty column.
      const overIndex = targetTasks.findIndex((t) => t.id === overId);
      const newIndex = overIndex === -1 ? currentIndex : overIndex;

      // True no-op: started and ended in the same column, at the same index
      if (!columnChanged && currentIndex === newIndex) return;

      const reordered = arrayMove(targetTasks, currentIndex, newIndex);
      const prevPos = reordered[newIndex - 1]?.position ?? null;
      const nextPos = reordered[newIndex + 1]?.position ?? null;
      const newPosition = calculateNewPosition(prevPos, nextPos);

      setLocalTasks((prev) => ({
        ...prev,
        [targetColId]: reordered.map((t) =>
          t.id === activeId ? { ...t, columnId: targetColId, position: newPosition } : t,
        ),
      }));

      onTaskMoved({
        taskId: activeId,
        sourceColumnId: sourceColId,
        targetColumnId: targetColId,
        newPosition,
      });
      return;
    }

    const currentColId = findColumnIdForTask(localTasks, activeId);
    if (!currentColId) return;

    const task = (localTasks[currentColId] ?? []).find((t) => t.id === activeId);

    if (!task) return;

    const lastPosition = targetTasks.at(-1)?.position ?? null;
    const newPosition = calculateNewPosition(lastPosition, null);

    setLocalTasks((prev) => ({
      ...prev,
      /* v8 ignore next -- currentColId's entry is guaranteed to exist in prev, same state as above */
      [currentColId]: (prev[currentColId] ?? []).filter((t) => t.id !== activeId),
      [targetColId]: [
        ...(prev[targetColId] ?? []),
        { ...task, columnId: targetColId, position: newPosition },
      ],
    }));

    onTaskMoved({
      taskId: activeId,
      sourceColumnId: sourceColId,
      targetColumnId: targetColId,
      newPosition,
    });
  }

  return {
    activeTaskId,
    localTasks,
    handlers: { onDragStart, onDragOver, onDragEnd },
  };
}
