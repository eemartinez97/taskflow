"use client";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useState } from "react";

import type { Column } from "@taskflow/database";

import { calculateNewPosition } from "@/lib/board/position";

export interface ColumnMovePayload {
  /** Columns whose position changed - always exactly the moved one. */
  columns: { id: string; position: number }[];
}

interface UseColumnDnDOptions {
  initialColumns: Column[];
  onColumnsReordered: (payload: ColumnMovePayload) => void;
}

interface UseColumnDnDResult {
  columns: Column[];
  activeColumnId: string | null;
  onColumnDragStart: (e: DragStartEvent) => void;
  onColumnDragEnd: (e: DragEndEvent) => void;
}

/**
 * Manages horizontal column reordering via DnD.
 *
 * SRP: this hook owns ONLY column order state and position calculation.
 * Task DnD lives in `useBoardDnD`. The two hooks are composed in KanbanBoard.
 *
 * Algorithm:
 * 1. onColumnDragStart - record active column id.
 * 2. onColumnDragEnd   - arrayMove to new index, recalculate positions
 *                        using the same midpoint strategy as useBoardDnD,
 *                        call onColumnsReordered with the full ordered payload.
 */

export function useColumnDnD({
  initialColumns,
  onColumnsReordered,
}: UseColumnDnDOptions): UseColumnDnDResult {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  // Sync when the TanStack Query cache changes externally (rename,
  // setColumnStatus, addColumn, deleteColumn, reorderColumns, or a
  // board:updated socket event) and no drag is in progress. Reference
  // equality, not an id-derived key - a key built from just the id set
  // (the previous approach) misses property-only changes like a rename or
  // a status-mapping change, since those never touch which ids exist. See
  // use-board-dnd.ts's identical pattern for the task-DnD equivalent.
  const [prevInitialColumns, setPrevInitialColumns] = useState<Column[]>(initialColumns);
  if (prevInitialColumns !== initialColumns && activeColumnId === null) {
    setPrevInitialColumns(initialColumns);
    setColumns(initialColumns);
  }

  function onColumnDragStart(e: DragStartEvent): void {
    setActiveColumnId(String(e.active.id));
  }

  function onColumnDragEnd(e: DragEndEvent): void {
    setActiveColumnId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const oldIndex = columns.findIndex((c) => c.id === activeId);
    const newIndex = columns.findIndex((c) => c.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    // Recalculate positions using midpoint strategy to avoid renumbering all
    const reordered = arrayMove(columns, oldIndex, newIndex);
    const prevPos = reordered[newIndex - 1]?.position ?? null;
    const nextPos = reordered[newIndex + 1]?.position ?? null;
    const newPosition = calculateNewPosition(prevPos, nextPos);

    setColumns(
      reordered.map((col) => (col.id === activeId ? { ...col, position: newPosition } : col)),
    );

    onColumnsReordered({ columns: [{ id: activeId, position: newPosition }] });
  }

  return { columns, activeColumnId, onColumnDragStart, onColumnDragEnd };
}
