import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";
import { useCursorBroadcast } from "@/lib/hooks/use-cursor-broadcast";
import { mockSocket, resetHandlerStore } from "@/tests/mocks/socket-io-client";

const socketRef = { current: mockSocket as never };

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  resetHandlerStore();
  vi.useRealTimers();
});

function makePointerEvent(
  x: number,
  y: number,
  target: { closest: (selector: string) => HTMLElement | null } = { closest: () => null },
) {
  return {
    clientX: x,
    clientY: y,
    target,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      scrollLeft: 0,
      scrollTop: 0,
    },
  } as unknown as React.PointerEvent<HTMLElement>;
}

function makeColumnTarget(columnId: string, rectTop: number, scrollTop: number) {
  const columnEl = {
    getBoundingClientRect: () => ({ left: 0, top: rectTop }),
    scrollTop,
    dataset: { columnScroll: columnId },
  } as unknown as HTMLElement;
  return { closest: () => columnEl };
}

describe("useCursorBroadcast", () => {
  it("emits PRESENCE_CURSOR with relative coordinates", () => {
    const { result } = renderHook(() => useCursorBroadcast(socketRef, "u1"));
    result.current.onPointerMove(makePointerEvent(50, 60));
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.PRESENCE_CURSOR,
      expect.objectContaining({ userId: "u1", x: 50, y: 60 }),
    );
  });

  it("throttles rapid successive moves", () => {
    const { result } = renderHook(() => useCursorBroadcast(socketRef, "u1"));
    result.current.onPointerMove(makePointerEvent(1, 1));
    result.current.onPointerMove(makePointerEvent(2, 2));
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
  });

  it("emits again after the throttle window elapses", () => {
    const { result } = renderHook(() => useCursorBroadcast(socketRef, "u1"));
    result.current.onPointerMove(makePointerEvent(1, 1));
    vi.advanceTimersByTime(60);
    result.current.onPointerMove(makePointerEvent(2, 2));
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
  });

  it("does not emit when userId is empty", () => {
    const { result } = renderHook(() => useCursorBroadcast(socketRef, ""));
    result.current.onPointerMove(makePointerEvent(1, 1));
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("does not emit when there is no socket", () => {
    const { result } = renderHook(() => useCursorBroadcast(null, "u1"));
    result.current.onPointerMove(makePointerEvent(1, 1));
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("onPointerLeave emits PRESENCE_CURSOR_LEAVE", () => {
    const { result } = renderHook(() => useCursorBroadcast(socketRef, "u1"));
    result.current.onPointerLeave();
    expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE);
  });

  it("emits column-relative coordinates + columnId when the pointer is over a column's task list", () => {
    const { result } = renderHook(() => useCursorBroadcast(socketRef, "u1"));
    result.current.onPointerMove(makePointerEvent(50, 130, makeColumnTarget("col-1", 20, 40)));
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.PRESENCE_CURSOR,
      // y = clientY(130) - columnRect.top(20) + column.scrollTop(40) = 150
      { userId: "u1", x: 50, y: 150, columnId: "col-1" },
    );
  });

  it("onPointerLeave is a no-op with no socket", () => {
    const { result } = renderHook(() => useCursorBroadcast(null, "u1"));
    expect(() => {
      result.current.onPointerLeave();
    }).not.toThrow();
  });
});
