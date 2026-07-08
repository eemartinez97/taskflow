import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { type MovePayload, useBoardDnD } from "@/hooks/use-board-dnd";
import {
  makeColumn,
  makeTask,
  makeTasksMap,
  VALID_COL_A_ID,
  VALID_COL_B_ID,
  VALID_TASK_1_ID,
} from "@/tests/helpers";

// -- Fixtures --

const colA = makeColumn({ id: VALID_COL_A_ID, name: "To Do" });
const colB = makeColumn({ id: VALID_COL_B_ID, name: "In Progress", position: 2000 });
const task1 = makeTask({ id: VALID_TASK_1_ID, columnId: VALID_COL_A_ID, position: 1000 });
const task2 = makeTask({ id: "task-2", columnId: VALID_COL_A_ID, position: 2000 });

// -- Helper: build minimal DnD event objects --

function makeDragStartEvent(taskId: string) {
  return { active: { id: taskId } } as Parameters<
    ReturnType<typeof useBoardDnD>["handlers"]["onDragStart"]
  >[0];
}

function makeDragOverEvent(activeId: string, overId: string) {
  return {
    active: { id: activeId },
    over: { id: overId },
  } as Parameters<ReturnType<typeof useBoardDnD>["handlers"]["onDragOver"]>[0];
}

function makeDragEndEvent(activeId: string, overId: string | null) {
  return {
    active: { id: activeId },
    over: overId ? { id: overId } : null,
  } as Parameters<ReturnType<typeof useBoardDnD>["handlers"]["onDragEnd"]>[0];
}

// -- Tests --

describe("useBoardDnD", () => {
  let onTaskMoved: (payload: MovePayload) => void;

  function setupHook(tasks = makeTasksMap()) {
    return renderHook(() =>
      useBoardDnD({
        columns: [colA, colB],
        initialTasks: tasks,
        onTaskMoved,
      }),
    );
  }

  beforeEach(() => {
    onTaskMoved = vi.fn<(payload: MovePayload) => void>();
  });

  // -- Initial state --

  it("starts with activeTaskId as null", () => {
    const { result } = setupHook();
    expect(result.current.activeTaskId).toBeNull();
  });

  it("initialises localTasks from initialTasks prop", () => {
    const tasks = makeTasksMap({ [VALID_COL_A_ID]: [task1] });
    const { result } = setupHook(tasks);
    expect(result.current.localTasks[VALID_COL_A_ID]).toHaveLength(1);
  });

  it("exposes onDragStart, onDragOver, onDragEnd handlers", () => {
    const { result } = setupHook();
    expect(typeof result.current.handlers.onDragStart).toBe("function");
    expect(typeof result.current.handlers.onDragOver).toBe("function");
    expect(typeof result.current.handlers.onDragEnd).toBe("function");
  });

  // -- onDragStart --

  it("onDragStart sets activeTaskId", () => {
    const { result } = setupHook();
    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
    });
    expect(result.current.activeTaskId).toBe(task1.id);
  });

  // -- onDragOver --

  it("onDragOver moves task to target column optimistically", () => {
    const tasks = makeTasksMap({ [VALID_COL_A_ID]: [task1], [VALID_COL_B_ID]: [] });
    const { result } = setupHook(tasks);

    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
      result.current.handlers.onDragOver(makeDragOverEvent(task1.id, VALID_COL_B_ID));
    });

    expect(result.current.localTasks[VALID_COL_A_ID]).toHaveLength(0);
    expect(result.current.localTasks[VALID_COL_B_ID]).toHaveLength(1);
  });

  it("onDragOver does nothing when over is null", () => {
    const tasks = makeTasksMap({ [VALID_COL_A_ID]: [task1] });
    const { result } = setupHook(tasks);

    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
      result.current.handlers.onDragOver({
        active: { id: task1.id },
        over: null,
      } as Parameters<ReturnType<typeof useBoardDnD>["handlers"]["onDragOver"]>[0]);
    });

    expect(result.current.localTasks[VALID_COL_A_ID]).toHaveLength(1);
  });

  it("onDragOver does nothing for same-column hover", () => {
    const tasks = makeTasksMap({ [VALID_COL_A_ID]: [task1, task2] });
    const { result } = setupHook(tasks);

    const before = result.current.localTasks[VALID_COL_A_ID]?.length ?? 0;
    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
      result.current.handlers.onDragOver(makeDragOverEvent(task1.id, task2.id));
    });

    // Same column hover — length unchanged
    expect(result.current.localTasks[VALID_COL_A_ID]).toHaveLength(before);
  });

  // -- onDragEnd --

  it("onDragEnd resets activeTaskId to null", () => {
    const { result } = setupHook();
    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
      result.current.handlers.onDragEnd(makeDragEndEvent(task1.id, null));
    });
    expect(result.current.activeTaskId).toBeNull();
  });

  it("onDragEnd with no `over` does not call onTaskMoved", () => {
    const { result } = setupHook();
    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
      result.current.handlers.onDragEnd(makeDragEndEvent(task1.id, null));
    });
    expect(onTaskMoved).not.toHaveBeenCalled();
  });

  it("onDragEnd same-column reorder calls onTaskMoved", () => {
    const tasks = makeTasksMap({ [VALID_COL_A_ID]: [task1, task2], [VALID_COL_B_ID]: [] });
    const { result } = setupHook(tasks);

    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
      result.current.handlers.onDragEnd(makeDragEndEvent(task1.id, task2.id));
    });

    expect(onTaskMoved).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task1.id,
        sourceColumnId: VALID_COL_A_ID,
        targetColumnId: VALID_COL_A_ID,
      }),
    );
  });

  it("onDragEnd cross-column move calls onTaskMoved with correct columnIds", () => {
    const tasks = makeTasksMap({ [VALID_COL_A_ID]: [task1], [VALID_COL_B_ID]: [] });
    const { result } = setupHook(tasks);

    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
      // Simulate: hover over colB during drag
      result.current.handlers.onDragOver(makeDragOverEvent(task1.id, VALID_COL_B_ID));
      // Drop on colB
      result.current.handlers.onDragEnd(makeDragEndEvent(task1.id, VALID_COL_B_ID));
    });

    expect(onTaskMoved).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task1.id,
        targetColumnId: VALID_COL_B_ID,
      }),
    );
  });

  it("onDragEnd newPosition is a positive number", () => {
    const tasks = makeTasksMap({ [VALID_COL_A_ID]: [task1, task2] });
    const { result } = setupHook(tasks);

    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
      result.current.handlers.onDragEnd(makeDragEndEvent(task1.id, task2.id));
    });

    const payload = vi.mocked(onTaskMoved).mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(typeof payload?.newPosition).toBe("number");
    expect(payload?.newPosition ?? -1).toBeGreaterThan(0);
  });

  it("does not call onTaskMoved if the same-column drag ends at same index", () => {
    const tasks = makeTasksMap({ [VALID_COL_A_ID]: [task1] });
    const { result } = setupHook(tasks);

    act(() => {
      result.current.handlers.onDragStart(makeDragStartEvent(task1.id));
      // Drop on itself
      result.current.handlers.onDragEnd(makeDragEndEvent(task1.id, task1.id));
    });

    expect(onTaskMoved).not.toHaveBeenCalled();
  });
});
