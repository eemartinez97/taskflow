import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/socket/client", () => ({ createSocket: vi.fn() }));

import { createSocket } from "@/lib/socket/client";
import { useSocket } from "@/lib/hooks/use-socket";
import { mockSocket, resetHandlerStore } from "@/tests/mocks/socket-io-client";

describe("useSocket", () => {
  afterEach(() => {
    resetHandlerStore();
  });
  it("creates and connects a socket on mount", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    const { result } = renderHook(() => useSocket("proj-1", "board-1"));
    expect(createSocket).toHaveBeenCalledWith("proj-1", "board-1");
    expect(mockSocket.connect).toHaveBeenCalledOnce();
    expect(result.current.current).toBe(mockSocket);
  });

  it("disconnects and nulls the ref on unmount", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    const { result, unmount } = renderHook(() => useSocket("proj-1"));
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalledOnce();
    expect(result.current.current).toBeNull();
  });

  it("handles createSocket returning null (SSR) gracefully", () => {
    vi.mocked(createSocket).mockReturnValue(null);
    const { result, unmount } = renderHook(() => useSocket("proj-1"));
    expect(result.current.current).toBeNull();
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
