import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBoardDnD } from "@/lib/hooks/use-board-dnd";
import { makeTask } from "@/tests/support/factories";
import { VALID_COL_A_ID, VALID_COL_B_ID } from "@/tests/support/fixtures";

const task1 = makeTask({ id: "t1", columnId: VALID_COL_A_ID, position: 1000 });
const task2 = makeTask({ id: "t2", columnId: VALID_COL_A_ID, position: 2000 });
const initialTasks = { [VALID_COL_A_ID]: [task1, task2], [VALID_COL_B_ID]: [] };

function start(id: string) {
  return { active: { id } } as unknown as Parameters<
    ReturnType<typeof useBoardDnD>["handlers"]["onDragStart"]
  >[0];
}
function over(activeId: string, overId: string | null) {
  return {
    active: { id: activeId },
    over: overId ? { id: overId } : null,
  } as unknown as Parameters<ReturnType<typeof useBoardDnD>["handlers"]["onDragOver"]>[0];
}
function end(activeId: string, overId: string | null) {
  return {
    active: { id: activeId },
    over: overId ? { id: overId } : null,
  } as unknown as Parameters<ReturnType<typeof useBoardDnD>["handlers"]["onDragEnd"]>[0];
}

describe("useBoardDnD", () => {
  it("onDragStart records the active task id", () => {
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved: vi.fn() }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    expect(result.current.activeTaskId).toBe(task1.id);
  });

  it("onDragOver moves the task across columns optimistically", () => {
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved: vi.fn() }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragOver(over(task1.id, VALID_COL_B_ID));
    });
    expect(result.current.localTasks[VALID_COL_B_ID]).toHaveLength(1);
    expect(result.current.localTasks[VALID_COL_A_ID]).toHaveLength(1);
  });

  it("onDragOver is a no-op for a same-column hover", () => {
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved: vi.fn() }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragOver(over(task1.id, task2.id));
    });
    expect(result.current.localTasks[VALID_COL_A_ID]).toHaveLength(2);
  });

  it("onDragOver does nothing when `over` is null", () => {
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved: vi.fn() }));
    act(() => {
      result.current.handlers.onDragOver(over(task1.id, null));
    });
    expect(result.current.localTasks[VALID_COL_A_ID]).toHaveLength(2);
  });

  it("onDragEnd with no `over` bails out and clears active state", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, null));
    });
    expect(onTaskMoved).not.toHaveBeenCalled();
    expect(result.current.activeTaskId).toBeNull();
  });

  it("is a true no-op when dropped in the same position of the same column", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, task1.id));
    });
    expect(onTaskMoved).not.toHaveBeenCalled();
  });

  it("reorders within the same column and reports the new position", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, task2.id));
    });
    expect(onTaskMoved).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: task1.id, targetColumnId: VALID_COL_A_ID }),
    );
  });

  it("moves cross-column via onDragOver relocation, then commits on drop over the column itself", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragOver(over(task1.id, VALID_COL_B_ID));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, VALID_COL_B_ID));
    });
    expect(onTaskMoved).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task1.id,
        sourceColumnId: VALID_COL_A_ID,
        targetColumnId: VALID_COL_B_ID,
      }),
    );
  });

  it("fallback path: onDragEnd without a prior onDragOver still relocates the task", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    // No onDragOver call - direct drop.
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, VALID_COL_B_ID));
    });
    expect(onTaskMoved).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: task1.id, targetColumnId: VALID_COL_B_ID }),
    );
    expect(result.current.localTasks[VALID_COL_B_ID]).toHaveLength(1);
  });

  it("fallback path bails out silently when the task can't be located at all", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start("ghost-task"));
    });
    act(() => {
      result.current.handlers.onDragEnd(end("ghost-task", VALID_COL_B_ID));
    });
    expect(onTaskMoved).not.toHaveBeenCalled();
  });

  it("re-syncs localTasks when initialTasks changes and no drag is active", () => {
    const { result, rerender } = renderHook(
      ({ initialTasks: it }) => useBoardDnD({ initialTasks: it, onTaskMoved: vi.fn() }),
      { initialProps: { initialTasks } },
    );
    const next = { [VALID_COL_A_ID]: [task1], [VALID_COL_B_ID]: [] };
    rerender({ initialTasks: next });
    expect(result.current.localTasks[VALID_COL_A_ID]).toHaveLength(1);
  });

  it("onDragEnd bails out when no drag start occurred (sourceColId null)", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, task2.id));
    });
    expect(onTaskMoved).not.toHaveBeenCalled();
  });

  it("reorders to the first position (prevPos null branch)", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task2.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task2.id, task1.id));
    });
    expect(onTaskMoved).toHaveBeenCalledWith(expect.objectContaining({ taskId: task2.id }));
  });

  it("fallback path computes position after existing tasks in a non-empty target column", () => {
    const onTaskMoved = vi.fn();
    const populated = {
      [VALID_COL_A_ID]: [task1, task2],
      [VALID_COL_B_ID]: [makeTask({ id: "t3", columnId: VALID_COL_B_ID, position: 500 })],
    };
    const { result } = renderHook(() => useBoardDnD({ initialTasks: populated, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, VALID_COL_B_ID));
    });
    expect(onTaskMoved).toHaveBeenCalledWith(
      expect.objectContaining({ targetColumnId: VALID_COL_B_ID }),
    );
  });

  it("fallback path computes the first position when the target column is empty", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, VALID_COL_B_ID));
    });
    expect(onTaskMoved).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: task1.id, targetColumnId: VALID_COL_B_ID }),
    );
  });

  it("fallback path handles a target column key present but with an undefined tasks array", () => {
    const onTaskMoved = vi.fn();
    const sparse = {
      [VALID_COL_A_ID]: [task1],
      [VALID_COL_B_ID]: undefined,
    } as unknown as typeof initialTasks;
    const { result } = renderHook(() => useBoardDnD({ initialTasks: sparse, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, VALID_COL_B_ID));
    });
    expect(onTaskMoved).toHaveBeenCalledWith(
      expect.objectContaining({ targetColumnId: VALID_COL_B_ID }),
    );
  });

  it("reorder path leaves untouched tasks unchanged via the ternary's else branch", () => {
    const onTaskMoved = vi.fn();
    const threeTasks = {
      [VALID_COL_A_ID]: [
        task1,
        task2,
        makeTask({ id: "t3", columnId: VALID_COL_A_ID, position: 3000 }),
      ],
    };
    const { result } = renderHook(() => useBoardDnD({ initialTasks: threeTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, "t3"));
    });
    const updatedList = result.current.localTasks[VALID_COL_A_ID] ?? [];
    const untouched = updatedList.find((t) => t.id === task2.id);
    expect(untouched).toBeDefined();
  });

  it("fallback path handles a missing source column key entirely", () => {
    const onTaskMoved = vi.fn();
    const noSourceKey = { [VALID_COL_B_ID]: [] } as unknown as typeof initialTasks;
    const { result } = renderHook(() => useBoardDnD({ initialTasks: noSourceKey, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start("ghost-task"));
    });
    act(() => {
      result.current.handlers.onDragEnd(end("ghost-task", VALID_COL_B_ID));
    });
    expect(onTaskMoved).not.toHaveBeenCalled();
  });

  it("onDragEnd bails out when the target column cannot be resolved", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end(task1.id, "unknown-drop-target"));
    });
    expect(onTaskMoved).not.toHaveBeenCalled();
  });

  it("fallback path bails out when the active task no longer exists anywhere at drop time", () => {
    const onTaskMoved = vi.fn();
    const { result } = renderHook(() => useBoardDnD({ initialTasks, onTaskMoved }));
    act(() => {
      result.current.handlers.onDragStart(start(task1.id));
    });
    act(() => {
      result.current.handlers.onDragEnd(end("vanished-task", VALID_COL_B_ID));
    });
    expect(onTaskMoved).not.toHaveBeenCalled();
  });
});
