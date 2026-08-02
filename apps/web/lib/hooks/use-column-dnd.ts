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

  const columnsKey = initialColumns.map((c) => c.id).join(",");
  const [prevKey, setPrevKey] = useState(columnsKey);

  // Sync when parent re-renders with fresh columns (e.g. after addColumn)
  if (prevKey !== columnsKey && activeColumnId === null) {
    setPrevKey(columnsKey);
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
