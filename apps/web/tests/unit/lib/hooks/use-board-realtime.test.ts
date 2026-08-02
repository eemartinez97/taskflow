import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-socket", () => ({ useSocket: vi.fn() }));

import { SOCKET_EVENTS } from "@taskflow/shared";
import { useSocket } from "@/lib/hooks/use-socket";
import { useBoardRealtime } from "@/lib/hooks/use-board-realtime";
import { mockSocket, resetHandlerStore, triggerSocketEvent } from "@/tests/mocks/socket-io-client";
import { makeColumn } from "@/tests/support/factories";
import {
  VALID_BOARD_ID,
  VALID_COL_A_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
} from "@/tests/support/fixtures";
import { getLastMockUtils } from "@/tests/support/trpc";

afterEach(() => {
  resetHandlerStore();
});

const columns = [makeColumn({ id: VALID_COL_A_ID })];
const baseOpts = {
  orgId: VALID_ORG_ID,
  projectId: VALID_PROJECT_ID,
  boardId: VALID_BOARD_ID,
  columns,
};

describe("useBoardRealtime", () => {
  it("does nothing when the socket ref has no current socket", () => {
    vi.mocked(useSocket).mockReturnValue({ current: null });
    expect(() => renderHook(() => useBoardRealtime(baseOpts))).not.toThrow();
  });

  it("upserts a task into its column cache on TASK_CREATED", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));

    const utils = getLastMockUtils();

    const setData = utils.tasks.list.setData;

    triggerSocketEvent(SOCKET_EVENTS.TASK_CREATED, {
      task: { id: "t1", columnId: VALID_COL_A_ID },
    });
    expect(setData).toHaveBeenCalled();
    // Actually invoke the updater lambda passed as the 2nd arg to setData -
    // the mock only records the call, it never calls it itself.
    const updater = setData.mock.calls.at(-1)?.[1] as (
      prev: { id: string }[] | undefined,
    ) => unknown[];
    expect(updater(undefined)).toEqual([{ id: "t1", columnId: VALID_COL_A_ID }]);
  });

  it("applies board:updated only when the event's board matches the current board", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));

    const utils = getLastMockUtils();

    triggerSocketEvent(SOCKET_EVENTS.BOARD_UPDATED, {
      board: { id: "other-board", name: "X", columns: [] },
    });
    expect(utils.boards.get.setData).not.toHaveBeenCalled();
    triggerSocketEvent(SOCKET_EVENTS.BOARD_UPDATED, {
      board: { id: VALID_BOARD_ID, name: "X", columns: [] },
    });
    expect(utils.boards.get.setData).toHaveBeenCalled();
  });

  it("cleans up every subscribed event on unmount", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    const { unmount } = renderHook(() => useBoardRealtime(baseOpts));
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_CREATED, expect.any(Function));
  });

  it("applies a task move across the column snapshot on TASK_MOVED", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));
    const utils = getLastMockUtils();

    vi.mocked(utils.tasks.list.getData).mockReturnValue([]);
    triggerSocketEvent(SOCKET_EVENTS.TASK_MOVED, {
      task: { id: "t1", columnId: VALID_COL_A_ID, position: 100 },
    });
    expect(utils.tasks.list.setData).toHaveBeenCalled();
  });

  it("removes a task from every column cache on TASK_DELETED", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));
    const utils = getLastMockUtils();

    triggerSocketEvent(SOCKET_EVENTS.TASK_DELETED, { taskId: "t1" });
    expect(utils.tasks.list.setData).toHaveBeenCalled();
    // Actually invoke the updater lambda passed as the 2nd arg to setData.
    const updater = utils.tasks.list.setData.mock.calls.at(-1)?.[1] as (
      prev: { id: string }[] | undefined,
    ) => unknown[];
    expect(updater([{ id: "t1" }, { id: "t2" }])).toEqual([{ id: "t2" }]);
  });

  it("replaces label pairs for a task on TASK_LABELS_CHANGED", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));
    const utils = getLastMockUtils();

    triggerSocketEvent(SOCKET_EVENTS.TASK_LABELS_CHANGED, {
      taskId: "t1",
      labels: [{ id: "l1", name: "Bug", color: "#EF4444" }],
    });
    expect(utils.tasks.labelsByProject.setData).toHaveBeenCalled();
    const updater = utils.tasks.labelsByProject.setData.mock.calls[0]?.[1] as (
      prev: { taskId: string }[] | undefined,
    ) => unknown[];
    expect(updater(undefined)).toEqual([
      { taskId: "t1", label: { id: "l1", name: "Bug", color: "#EF4444" } },
    ]);
  });

  it("appends a new comment on COMMENT_CREATED and dedupes an existing id", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));
    const utils = getLastMockUtils();

    triggerSocketEvent(SOCKET_EVENTS.COMMENT_CREATED, {
      comment: { id: "c1", taskId: "t1", body: "Hi" },
    });
    const updater = utils.comments.list.setData.mock.calls[0]?.[1] as (
      prev: { id: string }[] | undefined,
    ) => unknown[];
    expect(updater([{ id: "c1" }])).toEqual([{ id: "c1" }]);
    expect(updater(undefined)).toEqual([{ id: "c1", taskId: "t1", body: "Hi" }]);
  });

  it("removes a comment on COMMENT_DELETED", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));
    const utils = getLastMockUtils();

    triggerSocketEvent(SOCKET_EVENTS.COMMENT_DELETED, { commentId: "c1", taskId: "t1" });
    const updater = utils.comments.list.setData.mock.calls[0]?.[1] as (
      prev: { id: string }[],
    ) => unknown[];
    expect(updater([{ id: "c1" }, { id: "c2" }])).toEqual([{ id: "c2" }]);
  });

  it("removes a comment on COMMENT_DELETED even when the cache was empty", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));
    const utils = getLastMockUtils();

    triggerSocketEvent(SOCKET_EVENTS.COMMENT_DELETED, { commentId: "c1", taskId: "t1" });
    const updater = utils.comments.list.setData.mock.calls[0]?.[1] as (
      prev: { id: string }[] | undefined,
    ) => unknown[];
    expect(updater(undefined)).toEqual([]);
  });

  it("replaces label pairs for a task on TASK_LABELS_CHANGED, handling both an empty and a populated cache", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));
    const utils = getLastMockUtils();

    triggerSocketEvent(SOCKET_EVENTS.TASK_LABELS_CHANGED, {
      taskId: "t1",
      labels: [{ id: "l1", name: "Bug", color: "#EF4444" }],
    });
    const updater = utils.tasks.labelsByProject.setData.mock.calls[0]?.[1] as (
      prev: { taskId: string }[] | undefined,
    ) => unknown[];
    // prev undefined -> falsy branch of `prev ?? []`
    expect(updater(undefined)).toEqual([
      { taskId: "t1", label: { id: "l1", name: "Bug", color: "#EF4444" } },
    ]);
    // prev populated with an unrelated pair -> kept
    expect(updater([{ taskId: "t2" }])).toEqual([
      { taskId: "t2" },
      { taskId: "t1", label: { id: "l1", name: "Bug", color: "#EF4444" } },
    ]);
    // prev populated with a pair for the SAME taskId -> filtered out and replaced
    expect(updater([{ taskId: "t1" }])).toEqual([
      { taskId: "t1", label: { id: "l1", name: "Bug", color: "#EF4444" } },
    ]);
  });

  it("defaults to an empty array in the snapshot when the cache has no entry for a column", () => {
    vi.mocked(useSocket).mockReturnValue({ current: mockSocket as never });
    renderHook(() => useBoardRealtime(baseOpts));
    const utils = getLastMockUtils();

    vi.mocked(utils.tasks.list.getData).mockReturnValueOnce(undefined);
    triggerSocketEvent(SOCKET_EVENTS.TASK_MOVED, {
      task: { id: "t1", columnId: VALID_COL_A_ID, position: 100 },
    });
    expect(utils.tasks.list.setData).toHaveBeenCalled();
  });
});
