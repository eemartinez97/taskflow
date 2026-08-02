import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useColumnDnD } from "@/lib/hooks/use-column-dnd";
import { makeColumn } from "@/tests/support/factories";
import { VALID_COL_A_ID, VALID_COL_B_ID } from "@/tests/support/fixtures";

const columnA = makeColumn({ id: VALID_COL_A_ID, position: 1000 });
const columnB = makeColumn({ id: VALID_COL_B_ID, position: 2000 });

function dragEvent(activeId: string) {
  return { active: { id: activeId } } as unknown as Parameters<
    ReturnType<typeof useColumnDnD>["onColumnDragStart"]
  >[0];
}
function dragEndEvent(activeId: string, overId: string | null) {
  return {
    active: { id: activeId },
    over: overId ? { id: overId } : null,
  } as unknown as Parameters<ReturnType<typeof useColumnDnD>["onColumnDragEnd"]>[0];
}

describe("useColumnDnD", () => {
  it("sets activeColumnId on drag start", () => {
    const { result } = renderHook(() =>
      useColumnDnD({ initialColumns: [columnA, columnB], onColumnsReordered: vi.fn() }),
    );
    act(() => {
      result.current.onColumnDragStart(dragEvent(columnA.id));
    });
    expect(result.current.activeColumnId).toBe(columnA.id);
  });

  it("does nothing on drag end when over is null", () => {
    const onColumnsReordered = vi.fn();
    const { result } = renderHook(() =>
      useColumnDnD({ initialColumns: [columnA, columnB], onColumnsReordered }),
    );
    act(() => {
      result.current.onColumnDragEnd(dragEndEvent(columnA.id, null));
    });
    expect(onColumnsReordered).not.toHaveBeenCalled();
    expect(result.current.activeColumnId).toBeNull();
  });

  it("does nothing when dropped on itself", () => {
    const onColumnsReordered = vi.fn();
    const { result } = renderHook(() =>
      useColumnDnD({ initialColumns: [columnA, columnB], onColumnsReordered }),
    );
    act(() => {
      result.current.onColumnDragEnd(dragEndEvent(columnA.id, columnA.id));
    });
    expect(onColumnsReordered).not.toHaveBeenCalled();
  });

  it("reorders columns and reports the new position", () => {
    const onColumnsReordered = vi.fn();
    const { result } = renderHook(() =>
      useColumnDnD({ initialColumns: [columnA, columnB], onColumnsReordered }),
    );
    act(() => {
      result.current.onColumnDragEnd(dragEndEvent(columnA.id, columnB.id));
    });
    expect(onColumnsReordered).toHaveBeenCalledWith({
      columns: [{ id: columnA.id, position: expect.any(Number) as number }],
    });
    expect(result.current.columns[1]?.id).toBe(columnA.id);
  });

  it("bails out gracefully when active/over ids don't match any known column", () => {
    const onColumnsReordered = vi.fn();
    const { result } = renderHook(() =>
      useColumnDnD({ initialColumns: [columnA, columnB], onColumnsReordered }),
    );
    act(() => {
      result.current.onColumnDragEnd(dragEndEvent("ghost-id", columnB.id));
    });
    expect(onColumnsReordered).not.toHaveBeenCalled();
  });

  it("re-syncs columns when a fresh initialColumns reference arrives and no drag is active", () => {
    const { result, rerender } = renderHook(
      ({ initialColumns }) => useColumnDnD({ initialColumns, onColumnsReordered: vi.fn() }),
      { initialProps: { initialColumns: [columnA] } },
    );
    expect(result.current.columns).toHaveLength(1);
    rerender({ initialColumns: [columnA, columnB] });
    expect(result.current.columns).toHaveLength(2);
  });

  it("does not resync columns when a drag is active even if initialColumns changes", () => {
    const { result, rerender } = renderHook(
      ({ initialColumns }) => useColumnDnD({ initialColumns, onColumnsReordered: vi.fn() }),
      { initialProps: { initialColumns: [columnA] } },
    );
    act(() => {
      result.current.onColumnDragStart(dragEvent(columnA.id));
    });
    rerender({ initialColumns: [columnA, columnB] });
    expect(result.current.columns).toHaveLength(1);
  });

  it("computes a position with no previous column when dropped at the start", () => {
    const onColumnsReordered = vi.fn();
    const { result } = renderHook(() =>
      useColumnDnD({ initialColumns: [columnA, columnB], onColumnsReordered }),
    );
    act(() => {
      result.current.onColumnDragEnd(dragEndEvent(columnB.id, columnA.id));
    });
    expect(onColumnsReordered).toHaveBeenCalledWith({
      columns: [{ id: columnB.id, position: expect.any(Number) as number }],
    });
  });

  it("computes a position with no next column when dropped at the end", () => {
    const columnC = makeColumn({ id: "col-c", position: 3000 });
    const onColumnsReordered = vi.fn();
    const { result } = renderHook(() =>
      useColumnDnD({ initialColumns: [columnA, columnB, columnC], onColumnsReordered }),
    );
    act(() => {
      result.current.onColumnDragEnd(dragEndEvent(columnA.id, columnC.id));
    });
    expect(onColumnsReordered).toHaveBeenCalledWith({
      columns: [{ id: columnA.id, position: expect.any(Number) as number }],
    });
  });
});
