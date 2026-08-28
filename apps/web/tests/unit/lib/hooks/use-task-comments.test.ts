import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
const stableSocketRef = { current: mockSocket };
vi.mock("@/lib/socket/socket-context", () => ({ useSocketRef: () => stableSocketRef }));

import { api } from "@/lib/trpc/client";
import { useTaskComments } from "@/lib/hooks/use-task-comments";
import { SOCKET_EVENTS } from "@taskflow/shared";
import { getLastMockUtils, mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { VALID_ORG_ID, VALID_PROJECT_ID } from "@/tests/support/fixtures";

const ARGS = { orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID, taskId: "t1" };

function getTypingHandler(): (payload: { taskId: string; userId: string }) => void {
  const call = mockSocket.on.mock.calls.find(([event]) => event === SOCKET_EVENTS.TASK_TYPING);
  if (!call) throw new Error("TASK_TYPING handler was not registered");
  return call[1] as (payload: { taskId: string; userId: string }) => void;
}

describe("useTaskComments", () => {
  it("exposes comments/isPending straight from the list query", () => {
    mockUseQuery(api.comments.list, [{ id: "c1" }]);
    const { result } = renderHook(() => useTaskComments(ARGS));
    expect(result.current.comments).toEqual([{ id: "c1" }]);
    expect(result.current.isPending).toBe(false);
  });

  it("submits the trimmed body via comments.create.mutate", () => {
    mockUseQuery(api.comments.list, []);
    const { mutateMock } = setupMutationMock(api.comments.create);
    const { result } = renderHook(() => useTaskComments(ARGS));

    act(() => {
      result.current.setBody("  Hello  ");
    });
    act(() => {
      result.current.submit();
    });

    expect(mutateMock).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      taskId: "t1",
      body: "Hello",
    });
  });

  it("does not submit an empty/whitespace-only body", () => {
    mockUseQuery(api.comments.list, []);
    const { mutateMock } = setupMutationMock(api.comments.create);
    const { result } = renderHook(() => useTaskComments(ARGS));

    act(() => {
      result.current.setBody("   ");
    });
    act(() => {
      result.current.submit();
    });

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("resets body to empty after a successful create", () => {
    mockUseQuery(api.comments.list, []);
    const { triggerSuccess } = setupMutationMock(api.comments.create);
    const { result } = renderHook(() => useTaskComments(ARGS));

    act(() => {
      result.current.setBody("Hi");
    });
    expect(result.current.body).toBe("Hi");

    act(() => {
      triggerSuccess({ id: "c1", body: "Hi", authorId: "u1" });
    });
    expect(result.current.body).toBe("");
  });

  it("deleteComment calls comments.delete.mutate with the right ids", () => {
    mockUseQuery(api.comments.list, []);
    const { mutateMock } = setupMutationMock(api.comments.delete);
    const { result } = renderHook(() => useTaskComments(ARGS));

    act(() => {
      result.current.deleteComment("c1");
    });

    expect(mutateMock).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      commentId: "c1",
    });
  });

  describe("cache updaters", () => {
    it("appends a new comment via the setData updater, deduping an existing id", () => {
      mockUseQuery(api.comments.list, []);
      const { triggerSuccess } = setupMutationMock(api.comments.create);
      renderHook(() => useTaskComments(ARGS));

      const newComment = { id: "c1", body: "Hi", authorId: "u1" };
      act(() => {
        triggerSuccess(newComment);
      });

      const utils = getLastMockUtils();
      const updater = utils.comments.list.setData.mock.calls[0]?.[1] as (
        prev: { id: string }[] | undefined,
      ) => unknown[];
      expect(updater(undefined)).toEqual([newComment]);
      expect(updater([newComment])).toEqual([newComment]);
      expect(updater([{ id: "c0" }])).toEqual([{ id: "c0" }, newComment]);
    });

    it("removes a comment via the setData updater on delete success", () => {
      mockUseQuery(api.comments.list, []);
      const { triggerSuccess } = setupMutationMock(api.comments.delete);
      renderHook(() => useTaskComments(ARGS));

      act(() => {
        triggerSuccess(undefined, { commentId: "c1" });
      });

      const utils = getLastMockUtils();
      const updater = utils.comments.list.setData.mock.calls[0]?.[1] as (
        prev: { id: string }[] | undefined,
      ) => unknown[];
      expect(updater(undefined)).toEqual([]);
      expect(updater([{ id: "c1" }, { id: "c2" }])).toEqual([{ id: "c2" }]);
    });
  });

  describe("typing indicator", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockSocket.on.mockClear();
      mockSocket.off.mockClear();
      mockSocket.emit.mockClear();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("adds a userId on TASK_TYPING for a matching taskId and clears it after the TTL", () => {
      mockUseQuery(api.comments.list, []);
      const { result } = renderHook(() => useTaskComments(ARGS));

      act(() => {
        getTypingHandler()({ taskId: "t1", userId: "u1" });
      });
      expect(result.current.typingUserIds).toEqual(["u1"]);

      act(() => {
        vi.advanceTimersByTime(3100);
      });
      expect(result.current.typingUserIds).toEqual([]);
    });

    it("ignores TASK_TYPING events for a different taskId", () => {
      mockUseQuery(api.comments.list, []);
      const { result } = renderHook(() => useTaskComments(ARGS));

      act(() => {
        getTypingHandler()({ taskId: "other-task", userId: "u1" });
      });
      expect(result.current.typingUserIds).toEqual([]);
    });

    it("does not duplicate the same user id when TASK_TYPING repeats before the TTL", () => {
      mockUseQuery(api.comments.list, []);
      const { result } = renderHook(() => useTaskComments(ARGS));

      act(() => {
        getTypingHandler()({ taskId: "t1", userId: "u1" });
        getTypingHandler()({ taskId: "t1", userId: "u1" });
      });
      expect(result.current.typingUserIds).toEqual(["u1"]);
    });

    it("cleans up socket listeners and timers on unmount", () => {
      mockUseQuery(api.comments.list, []);
      const { result, unmount } = renderHook(() => useTaskComments(ARGS));

      act(() => {
        getTypingHandler()({ taskId: "t1", userId: "u1" });
      });
      unmount();
      expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_TYPING, expect.any(Function));
      void result; // referenced only to keep the hook mounted above
    });
  });

  describe("typing broadcast throttle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("emits TASK_TYPING throttled to once per second", () => {
      mockUseQuery(api.comments.list, []);
      const { result } = renderHook(() => useTaskComments(ARGS));

      act(() => {
        result.current.notifyTyping();
        result.current.notifyTyping();
      });
      expect(mockSocket.emit).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(1100);
      });
      act(() => {
        result.current.notifyTyping();
      });
      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    });
  });
});
