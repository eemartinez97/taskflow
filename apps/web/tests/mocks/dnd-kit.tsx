/**
 * Mock for @dnd-kit/core and @dnd-kit/sortable.
 *
 * Replaces sensor hooks, DndContext, DragOverlay, useSortable and
 * useDroppable with no-op implementations so Kanban components render
 * in jsdom without requiring pointer events or a real drag context.
 *
 * Activate per test file:
 *   vi.mock("@dnd-kit/core",     () => import("@/tests/mocks/dnd-kit"));
 *   vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit"));
 */

import type { JSX } from "react";
import { vi } from "vitest";

// -- Sensors (no-op) --
export const useSensors = vi.fn(() => []);
export const useSensor = vi.fn();
export const PointerSensor = vi.fn();
export const KeyboardSensor = vi.fn();
export const closestCenter = vi.fn();
export const sortableKeyboardCoordinates = vi.fn();

// -- useSortable --
export const useSortable = vi.fn(() => ({
  attributes: {},
  listeners: {},
  setNodeRef: vi.fn(),
  transform: null,
  transition: null,
  isDragging: false,
}));

// -- useDroppable --
export const useDroppable = vi.fn(() => ({
  setNodeRef: vi.fn(),
  isOver: false,
}));

// -- DndContext (passthrough) --
export function DndContext({
  children,
  onDragStart: _s,
  onDragOver: _o,
  onDragEnd: _e,
}: {
  children: React.ReactNode;
  onDragStart?: unknown;
  onDragOver?: unknown;
  onDragEnd?: unknown;
}): JSX.Element {
  return <>{children}</>;
}

// -- DragOverlay (hidden, no portal in jsdom) --
export function DragOverlay({ children }: { children?: React.ReactNode }): JSX.Element {
  return <div data-testid="drag-overlay">{children}</div>;
}

// -- SortableContext (passthrough) --
export function SortableContext({
  children,
}: {
  children: React.ReactNode;
  items?: unknown[];
  strategy?: unknown;
}): JSX.Element {
  return <>{children}</>;
}

// -- Utilities --
export const arrayMove = vi.fn((arr: unknown[], from: number, to: number): unknown[] => {
  const result = [...arr];
  const [item] = result.splice(from, 1);
  if (item !== undefined) result.splice(to, 0, item);
  return result;
});

export const CSS = {
  Transform: {
    toString: vi.fn(() => ""),
  },
};

// -- Strategies --
export const verticalListSortingStrategy = vi.fn();
export const horizontalListSortingStrategy = vi.fn();
