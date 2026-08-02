import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";
import { usePresence } from "@/lib/hooks/use-presence";
import { mockSocket, resetHandlerStore, triggerSocketEvent } from "@/tests/mocks/socket-io-client";

afterEach(() => {
  resetHandlerStore();
});

const socketRef = { current: mockSocket as never };

describe("usePresence", () => {
  it("returns an empty array before any event arrives", () => {
    const { result } = renderHook(() => usePresence(socketRef));
    expect(result.current).toEqual([]);
  });

  it("hydrates the roster on PRESENCE_SYNC", () => {
    const { result } = renderHook(() => usePresence(socketRef));
    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_SYNC, {
        users: [{ userId: "u1", name: "Alice", color: "#fff" }],
      });
    });
    expect(result.current).toHaveLength(1);
  });

  it("adds a user on PRESENCE_JOIN without duplicating an existing one", () => {
    const { result } = renderHook(() => usePresence(socketRef));
    const user = { userId: "u1", name: "Alice", color: "#fff" };
    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_JOIN, user);
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_JOIN, user);
    });
    expect(result.current).toHaveLength(1);
  });

  it("removes a user on PRESENCE_LEAVE", () => {
    const { result } = renderHook(() => usePresence(socketRef));
    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_JOIN, { userId: "u1", name: "A", color: "#fff" });
      triggerSocketEvent(SOCKET_EVENTS.PRESENCE_LEAVE, { userId: "u1" });
    });
    expect(result.current).toEqual([]);
  });

  it("does nothing when the socket ref has no current socket", () => {
    const { result } = renderHook(() => usePresence({ current: null }));
    expect(result.current).toEqual([]);
  });

  it("cleans up listeners and resets state on unmount", () => {
    const { unmount } = renderHook(() => usePresence(socketRef));
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_SYNC, expect.any(Function));
  });
});
