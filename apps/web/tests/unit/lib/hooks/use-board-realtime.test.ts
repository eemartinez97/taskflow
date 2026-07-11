import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("socket.io-client", () => import("@/tests/mocks/socket-io-client"));
vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));

import { SOCKET_EVENTS, type SocketTask } from "@taskflow/shared";

import {
  makeMockMutationResult,
  makeTRPCUtilsMock,
  VALID_PROJECT_ID,
  VALID_COL_A_ID,
  VALID_COL_B_ID,
  VALID_ORG_ID,
  toSocketTask,
  makeColumn,
  makeTask,
} from "@/tests/helpers";
import {
  triggerSocketEvent,
  resetHandlerStore,
  getHandlerStore,
  mockSocket,
  io,
} from "@/tests/mocks/socket-io-client";
import { useBoardRealtime } from "@/lib/hooks/use-board-realtime";
import { api } from "@/tests/mocks/trpc-api";

// -- Fixtures --

const colA = makeColumn({ id: VALID_COL_A_ID });
const colB = makeColumn({ id: VALID_COL_B_ID, position: 2000 });
const task1 = makeTask({ id: "t1", columnId: VALID_COL_A_ID, position: 1000 });
const socketTask1 = toSocketTask(task1);

const defaultOpts = {
  orgId: VALID_ORG_ID,
  projectId: VALID_PROJECT_ID,
  columns: [colA, colB],
};

// -- Setup --

beforeEach(() => {
  resetHandlerStore();
  vi.clearAllMocks();

  // Default useUtils mock with setData/getData spies
  const utilsMock = makeTRPCUtilsMock({
    [VALID_COL_A_ID]: [socketTask1],
    [VALID_COL_B_ID]: [],
  });

  vi.mocked(api.useUtils).mockReturnValue(utilsMock as never);

  // tasks.move.useMutation is referenced via api mock (board.tsx uses it)
  vi.mocked(api.tasks.move.useMutation).mockReturnValue(makeMockMutationResult() as never);
});

describe("event handler registration", () => {
  it("registers task:created handler on mount", () => {
    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    expect(getHandlerStore().has(SOCKET_EVENTS.TASK_CREATED)).toBe(true);
  });

  it("registers task:updated handler on mount", () => {
    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    expect(getHandlerStore().has(SOCKET_EVENTS.TASK_UPDATED)).toBe(true);
  });

  it("registers task:moved handler on mount", () => {
    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    expect(getHandlerStore().has(SOCKET_EVENTS.TASK_MOVED)).toBe(true);
  });

  it("registers task:deleted handler on mount", () => {
    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    expect(getHandlerStore().has(SOCKET_EVENTS.TASK_DELETED)).toBe(true);
  });

  it("registers exactly 4 handlers (one per task event)", () => {
    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    expect(mockSocket.on).toHaveBeenCalledTimes(4);
  });

  it("deregisters all 4 handlers on unmount", () => {
    const { unmount } = renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    unmount();
    expect(mockSocket.off).toHaveBeenCalledTimes(4);
  });

  it("deregisters handlers with the same function reference used in .on()", () => {
    const { unmount } = renderHook(() => {
      useBoardRealtime(defaultOpts);
    });

    const onCalls = vi.mocked(mockSocket.on).mock.calls as [string, (...args: unknown[]) => void][];
    const offCalls = vi.mocked(mockSocket.off).mock.calls as unknown as [
      string,
      (...args: unknown[]) => void,
    ][];

    unmount();

    // Event names must match between on and off
    const onEvents = onCalls.map(([e]) => e).sort();
    const offEvents = offCalls.map(([e]) => e).sort();
    expect(onEvents).toEqual(offEvents);
  });
});

describe("task:created event", () => {
  it("calls setData for the task's column", () => {
    const utils = makeTRPCUtilsMock({});
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    triggerSocketEvent(SOCKET_EVENTS.TASK_CREATED, { task: socketTask1 });

    expect(utils.tasks.list.setData).toHaveBeenCalledWith(
      { orgId: VALID_ORG_ID, columnId: VALID_COL_A_ID },
      expect.any(Function),
    );
  });

  it("updater function appends the new task", () => {
    const utils = makeTRPCUtilsMock({ [VALID_COL_A_ID]: [] });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    triggerSocketEvent(SOCKET_EVENTS.TASK_CREATED, { task: socketTask1 });

    const setDataCalls = vi.mocked(utils.tasks.list.setData).mock.calls as [
      { orgId: string; columnId: string },
      (prev: SocketTask[] | undefined) => SocketTask[],
    ][];
    const updater = setDataCalls[0]?.[1];
    const result = updater?.([]);
    expect(result).toContainEqual(expect.objectContaining({ id: socketTask1.id }));
  });

  it("updater replaces an existing task with the same id", () => {
    const utils = makeTRPCUtilsMock({ [VALID_COL_A_ID]: [socketTask1] });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });

    const updatedTask: SocketTask = { ...socketTask1, title: "Updated via socket" };
    triggerSocketEvent(SOCKET_EVENTS.TASK_CREATED, { task: updatedTask });

    const setDataCalls = vi.mocked(utils.tasks.list.setData).mock.calls as [
      { orgId: string; columnId: string },
      (prev: SocketTask[] | undefined) => SocketTask[],
    ][];
    const updater = setDataCalls[0]?.[1];
    const result = updater?.([socketTask1]);
    expect(result).toHaveLength(1);
    expect(result?.[0]?.title).toBe("Updated via socket");
  });
});

describe("task:updated event", () => {
  it("calls setData for the task's columnId", () => {
    const utils = makeTRPCUtilsMock({ [VALID_COL_A_ID]: [socketTask1] });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    triggerSocketEvent(SOCKET_EVENTS.TASK_UPDATED, { task: socketTask1 });

    expect(utils.tasks.list.setData).toHaveBeenCalledWith(
      { orgId: VALID_ORG_ID, columnId: VALID_COL_A_ID },
      expect.any(Function),
    );
  });

  it("updater merges updated fields", () => {
    const utils = makeTRPCUtilsMock({ [VALID_COL_A_ID]: [socketTask1] });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });

    const updatedTask: SocketTask = { ...socketTask1, title: "Renamed task" };
    triggerSocketEvent(SOCKET_EVENTS.TASK_UPDATED, { task: updatedTask });

    const setDataCalls = vi.mocked(utils.tasks.list.setData).mock.calls as [
      { orgId: string; columnId: string },
      (prev: SocketTask[] | undefined) => SocketTask[],
    ][];
    const updater = setDataCalls[0]?.[1];
    const result = updater?.([socketTask1]);
    expect(result?.[0]?.title).toBe("Renamed task");
  });
});

describe("task:moved event", () => {
  it("calls getData for all columns to build snapshot", () => {
    const utils = makeTRPCUtilsMock({
      [VALID_COL_A_ID]: [socketTask1],
      [VALID_COL_B_ID]: [],
    });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });

    const movedTask: SocketTask = { ...socketTask1, columnId: VALID_COL_B_ID };
    triggerSocketEvent(SOCKET_EVENTS.TASK_MOVED, { task: movedTask });

    expect(utils.tasks.list.getData).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      columnId: VALID_COL_A_ID,
    });
    expect(utils.tasks.list.getData).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      columnId: VALID_COL_B_ID,
    });
  });

  it("calls setData for every column (full update)", () => {
    const utils = makeTRPCUtilsMock({
      [VALID_COL_A_ID]: [socketTask1],
      [VALID_COL_B_ID]: [],
    });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });

    const movedTask: SocketTask = { ...socketTask1, columnId: VALID_COL_B_ID };
    triggerSocketEvent(SOCKET_EVENTS.TASK_MOVED, { task: movedTask });

    // setData called once per column
    const setDataCalls = vi.mocked(utils.tasks.list.setData).mock.calls as [
      { columnId: string },
      unknown,
    ][];
    const updatedColumns = setDataCalls.map(([{ columnId }]) => columnId);
    expect(updatedColumns).toContain(VALID_COL_A_ID);
    expect(updatedColumns).toContain(VALID_COL_B_ID);
  });

  it("removes task from source column after move", () => {
    const utils = makeTRPCUtilsMock({
      [VALID_COL_A_ID]: [socketTask1],
      [VALID_COL_B_ID]: [],
    });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });

    triggerSocketEvent(SOCKET_EVENTS.TASK_MOVED, {
      task: { ...socketTask1, columnId: VALID_COL_B_ID },
    });

    // After event fires, setData updater for COL_A should produce empty array
    const colASetData = (
      vi.mocked(utils.tasks.list.setData).mock.calls as [{ columnId: string }, SocketTask[]][]
    ).find(([{ columnId }]) => columnId === VALID_COL_A_ID);
    const colAResult = colASetData?.[1];
    expect(colAResult).toHaveLength(0);
  });

  it("inserts task into target column after move", () => {
    const utils = makeTRPCUtilsMock({
      [VALID_COL_A_ID]: [socketTask1],
      [VALID_COL_B_ID]: [],
    });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });

    const movedTask: SocketTask = { ...socketTask1, columnId: VALID_COL_B_ID };
    triggerSocketEvent(SOCKET_EVENTS.TASK_MOVED, { task: movedTask });

    const colBSetData = (
      vi.mocked(utils.tasks.list.setData).mock.calls as [{ columnId: string }, SocketTask[]][]
    ).find(([{ columnId }]) => columnId === VALID_COL_B_ID);
    const colBResult = colBSetData?.[1];
    expect(colBResult).toHaveLength(1);
    expect(colBResult?.[0]?.id).toBe(socketTask1.id);
  });

  it("uses [] as snapshot when getData returns undefined (??-[] branch)", () => {
    // makeTRPCUtilsMock({}) → getData returns undefined for every column.
    // This exercises the `(cached ?? [])` false branch in onTaskMoved.
    const utils = makeTRPCUtilsMock({});
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });

    const movedTask: SocketTask = { ...socketTask1, columnId: VALID_COL_B_ID };
    expect(() => {
      triggerSocketEvent(SOCKET_EVENTS.TASK_MOVED, { task: movedTask });
    }).not.toThrow();

    // setData is called for every column even when the cache was empty
    const setDataCalls = vi.mocked(utils.tasks.list.setData).mock.calls as [
      { columnId: string },
      unknown,
    ][];
    const calledCols = setDataCalls.map(([{ columnId }]) => columnId);
    expect(calledCols).toContain(VALID_COL_A_ID);
    expect(calledCols).toContain(VALID_COL_B_ID);
  });
});

describe("task:deleted event", () => {
  it("calls setData for every column (exhaustive search)", () => {
    const utils = makeTRPCUtilsMock({
      [VALID_COL_A_ID]: [socketTask1],
      [VALID_COL_B_ID]: [],
    });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    triggerSocketEvent(SOCKET_EVENTS.TASK_DELETED, { taskId: socketTask1.id });

    const setDataCalls = vi.mocked(utils.tasks.list.setData).mock.calls as [
      { columnId: string },
      unknown,
    ][];
    const updatedColumns = setDataCalls.map(([{ columnId }]) => columnId);
    expect(updatedColumns).toContain(VALID_COL_A_ID);
    expect(updatedColumns).toContain(VALID_COL_B_ID);
  });

  it("updater removes the task from its column", () => {
    const utils = makeTRPCUtilsMock({ [VALID_COL_A_ID]: [socketTask1] });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    triggerSocketEvent(SOCKET_EVENTS.TASK_DELETED, { taskId: socketTask1.id });

    const colASetData = (
      vi.mocked(utils.tasks.list.setData).mock.calls as [
        { columnId: string },
        (prev: SocketTask[] | undefined) => SocketTask[],
      ][]
    ).find(([{ columnId }]) => columnId === VALID_COL_A_ID);

    const result = colASetData?.[1]?.([socketTask1]);
    expect(result).toHaveLength(0);
  });

  it("is a no-op when the taskId does not exist in any column", () => {
    const utils = makeTRPCUtilsMock({
      [VALID_COL_A_ID]: [socketTask1],
      [VALID_COL_B_ID]: [],
    });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    triggerSocketEvent(SOCKET_EVENTS.TASK_DELETED, { taskId: "non-existent-id" });

    // setData still called but the updater returns unchanged arrays
    const setDataCalls = vi.mocked(utils.tasks.list.setData).mock.calls as [
      { columnId: string },
      (prev: SocketTask[] | undefined) => SocketTask[],
    ][];

    const colAResult = setDataCalls.find(([{ columnId }]) => columnId === VALID_COL_A_ID)?.[1]?.([
      socketTask1,
    ]);
    expect(colAResult).toHaveLength(1); // unchanged
  });
});

// -- Connection forwarded to useSocket --

describe("socket connection (delegated to useSocket)", () => {
  it("socket.connect() is called on mount", () => {
    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    expect(mockSocket.connect).toHaveBeenCalledOnce();
  });

  it("socket.disconnect() is called on unmount", () => {
    const { unmount } = renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalledOnce();
  });
});

// -- Null socket — if (!socket) return early exit --

describe("null socket — if (!socket) return branch", () => {
  /**
   * When io() returns null (e.g. createSocket() is called on the server
   * or socket.io-client is unavailable), socketRef.current is null.
   * useBoardRealtime must exit the effect early without registering handlers.
   *
   * Simulated by overriding io() for a single call so createSocket() → null,
   * useSocket() stores null in socketRef, and the `if (!socket) return`
   * true-branch is executed.
   */
  beforeEach(() => {
    vi.mocked(io).mockReturnValueOnce(null as unknown as typeof mockSocket);
  });

  it("does not register any handlers when socket is null", () => {
    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it("does not call socket.connect() when socket is null", () => {
    renderHook(() => {
      useBoardRealtime(defaultOpts);
    });
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it("does not throw when socket is null", () => {
    expect(() =>
      renderHook(() => {
        useBoardRealtime(defaultOpts);
      }),
    ).not.toThrow();
  });
});
