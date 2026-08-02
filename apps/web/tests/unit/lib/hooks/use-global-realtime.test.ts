import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/socket/client", () => ({ createSocket: vi.fn() }));

import { SOCKET_EVENTS } from "@taskflow/shared";
import { createSocket } from "@/lib/socket/client";
import { toast } from "@/lib/toast/store";
import { useGlobalRealtime } from "@/lib/hooks/use-global-realtime";
import { getOnlineUsers } from "@/lib/socket/presence-store";
import { mockSocket, resetHandlerStore, triggerSocketEvent } from "@/tests/mocks/socket-io-client";
import { getLastMockUtils } from "@/tests/support/trpc";

afterEach(() => {
  resetHandlerStore();
});

describe("useGlobalRealtime", () => {
  it("does nothing when createSocket returns null (SSR)", () => {
    vi.mocked(createSocket).mockReturnValue(null);
    expect(() =>
      renderHook(() => {
        useGlobalRealtime();
      }),
    ).not.toThrow();
  });

  it("connects the socket and seeds the online roster on PRESENCE_ONLINE_SYNC", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useGlobalRealtime();
    });
    expect(mockSocket.connect).toHaveBeenCalledOnce();
    triggerSocketEvent(SOCKET_EVENTS.PRESENCE_ONLINE_SYNC, { userIds: ["u1"] });
    expect(getOnlineUsers().has("u1")).toBe(true);
  });

  it("adds/removes a user on PRESENCE_ONLINE / PRESENCE_OFFLINE", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useGlobalRealtime();
    });
    triggerSocketEvent(SOCKET_EVENTS.PRESENCE_ONLINE, { userId: "u2" });
    expect(getOnlineUsers().has("u2")).toBe(true);
    triggerSocketEvent(SOCKET_EVENTS.PRESENCE_OFFLINE, { userId: "u2" });
    expect(getOnlineUsers().has("u2")).toBe(false);
  });

  it("prepends a new notification to the cache and shows an info toast", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useGlobalRealtime();
    });
    triggerSocketEvent(SOCKET_EVENTS.NOTIFICATION_CREATED, {
      notification: { id: "n1", message: "Hello", read: false, createdAt: new Date() },
    });
    expect(toast.info).toHaveBeenCalledWith("Hello");
  });

  it("disconnects and resets presence on unmount", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    const { unmount } = renderHook(() => {
      useGlobalRealtime();
    });
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalledOnce();
  });

  it("only prepends the notification when the cache already has data", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useGlobalRealtime();
    });
    triggerSocketEvent(SOCKET_EVENTS.NOTIFICATION_CREATED, {
      notification: { id: "n1", message: "Hello", read: false, createdAt: new Date() },
    });
    const utils = getLastMockUtils();

    const updater = utils.notifications.list.setData.mock.calls[0]?.[1] as (
      prev: { notifications: unknown[]; unreadCount: number } | undefined,
    ) => unknown;
    expect(updater(undefined)).toBeUndefined();
    expect(updater({ notifications: [], unreadCount: 0 })).toEqual({
      notifications: [
        { id: "n1", message: "Hello", read: false, createdAt: expect.any(Date) as Date },
      ],
      unreadCount: 1,
    });
  });
});
