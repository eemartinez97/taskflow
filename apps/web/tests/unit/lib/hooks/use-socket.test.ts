import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("socket.io-client", () => import("@/tests/mocks/socket-io-client"));

import { mockSocket, resetHandlerStore } from "@/tests/mocks/socket-io-client";
import { useSocket } from "@/lib/hooks/use-socket";

beforeEach(() => {
  resetHandlerStore();
});
afterEach(() => vi.clearAllMocks());

describe("useSocket", () => {
  it("returns a ref object", () => {
    const { result } = renderHook(() => useSocket("proj-1"));
    expect(result.current).toHaveProperty("current");
  });

  it("calls socket.connect() on mount", () => {
    renderHook(() => useSocket("proj-1"));
    expect(mockSocket.connect).toHaveBeenCalledOnce();
  });

  it("calls socket.disconnect() on unmount", () => {
    const { unmount } = renderHook(() => useSocket("proj-1"));
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalledOnce();
  });

  it("ref holds the socket instance after mount", () => {
    const { result } = renderHook(() => useSocket("proj-1"));
    expect(result.current.current).toBe(mockSocket);
  });

  it("ref is null after unmount", () => {
    const { result, unmount } = renderHook(() => useSocket("proj-1"));
    unmount();
    expect(result.current.current).toBeNull();
  });

  it("reconnects when projectId changes", () => {
    const { rerender } = renderHook(({ pid }) => useSocket(pid), {
      initialProps: { pid: "proj-1" },
    });

    expect(mockSocket.connect).toHaveBeenCalledTimes(1);

    rerender({ pid: "proj-2" });

    // Old socket disconnected, new socket connected
    expect(mockSocket.disconnect).toHaveBeenCalledOnce();
    expect(mockSocket.connect).toHaveBeenCalledTimes(2);
  });

  it("does not connect more than once for the same projectId", () => {
    const { rerender } = renderHook(({ pid }) => useSocket(pid), {
      initialProps: { pid: "stable-proj" },
    });
    rerender({ pid: "stable-proj" });
    rerender({ pid: "stable-proj" });

    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  });
});
