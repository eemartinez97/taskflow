import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";
import { useCursors } from "@/lib/hooks/use-cursors";
import { mockSocket, resetHandlerStore, triggerSocketEvent } from "@/tests/mocks/socket-io-client";

const socketRef = { current: mockSocket as never };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  resetHandlerStore();
  vi.useRealTimers();
});

describe("useCursors", () => {
  it("returns an empty array with no socket", () => {
    const { result } = renderHook(() => useCursors(null));
    expect(result.current).toEqual([]);
  });

  it("returns an empty array when socketRef.current is null", () => {
    const emptyRef = { current: null };
    const { result } = renderHook(() => useCursors(emptyRef));
    expect(result.current).toEqual([]);
  });

  it("adds a cursor on PRESENCE_CURSOR", () => {
    const { result } = renderHook(() => useCursors(socketRef));
    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_CURSOR, { userId: "u1", x: 1, y: 2 });
    });
    expect(result.current).toHaveLength(1);
  });

  it("drops a cursor explicitly on PRESENCE_CURSOR_LEAVE", () => {
    const { result } = renderHook(() => useCursors(socketRef));
    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_CURSOR, { userId: "u1", x: 1, y: 2 });
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE, { userId: "u1" });
    });
    expect(result.current).toEqual([]);
  });

  it("drops a cursor automatically after the TTL elapses with no refresh", () => {
    const { result } = renderHook(() => useCursors(socketRef));
    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_CURSOR, { userId: "u1", x: 1, y: 2 });
      vi.advanceTimersByTime(3_100);
    });
    expect(result.current).toEqual([]);
  });

  it("refreshes the TTL when a new packet arrives before expiry", () => {
    const { result } = renderHook(() => useCursors(socketRef));
    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_CURSOR, { userId: "u1", x: 1, y: 2 });
      vi.advanceTimersByTime(2_000);
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_CURSOR, { userId: "u1", x: 3, y: 4 });
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current).toHaveLength(1);
  });

  it("clears all cursors and timers on unmount", () => {
    const { unmount } = renderHook(() => useCursors(socketRef));
    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_CURSOR, { userId: "u1", x: 1, y: 2 });
    });
    unmount();
    expect(mockSocket.off).toHaveBeenCalled();
  });

  it("does nothing when leaving for a cursor that was never tracked", () => {
    const { result } = renderHook(() => useCursors(socketRef));
    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE, { userId: "ghost" });
    });
    expect(result.current).toEqual([]);
  });
});
