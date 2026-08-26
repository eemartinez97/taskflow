import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/socket/client", () => ({ createSocket: vi.fn() }));
vi.mock("@/lib/utils/active-org", () => ({ readActiveOrgId: vi.fn(() => null) }));

import { SOCKET_EVENTS } from "@taskflow/shared";
import { createSocket } from "@/lib/socket/client";
import { toast } from "@/lib/toast/store";
import { useGlobalRealtime } from "@/lib/hooks/use-global-realtime";
import { getOnlineUsers } from "@/lib/socket/presence-store";
import { readActiveOrgId } from "@/lib/utils/active-org";
import { mockSocket, resetHandlerStore, triggerSocketEvent } from "@/tests/mocks/socket-io-client";
import { getLastMockUtils } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

afterEach(() => {
  resetHandlerStore();
  vi.mocked(readActiveOrgId).mockReturnValue(null);
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

  it("invalidates that org's members/formerAssignees/assigneeLookup/orgs.list caches on a MEMBER_LEFT notification", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useGlobalRealtime();
    });
    triggerSocketEvent(SOCKET_EVENTS.NOTIFICATION_CREATED, {
      notification: {
        id: "n1",
        type: "MEMBER_LEFT",
        entityId: "org-1",
        message: "Bob left",
        read: false,
        createdAt: new Date(),
      },
    });
    const utils = getLastMockUtils();
    expect(utils.orgs.members.invalidate).toHaveBeenCalledWith({ orgId: "org-1" });
    expect(utils.orgs.formerAssignees.invalidate).toHaveBeenCalledWith({ orgId: "org-1" });
    expect(utils.orgs.assigneeLookup.invalidate).toHaveBeenCalledWith({ orgId: "org-1" });
    expect(utils.orgs.list.invalidate).toHaveBeenCalled();
  });

  it("refreshes the page on MEMBER_LEFT when the affected org is the one currently in view", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    vi.mocked(readActiveOrgId).mockReturnValue("org-1");
    const { refreshMock } = setupRouterMock();
    renderHook(() => {
      useGlobalRealtime();
    });
    triggerSocketEvent(SOCKET_EVENTS.NOTIFICATION_CREATED, {
      notification: {
        id: "n1",
        type: "MEMBER_LEFT",
        entityId: "org-1",
        message: "Bob left",
        read: false,
        createdAt: new Date(),
      },
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("does not refresh on MEMBER_LEFT for an org other than the one currently in view", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    vi.mocked(readActiveOrgId).mockReturnValue("org-2");
    const { refreshMock } = setupRouterMock();
    renderHook(() => {
      useGlobalRealtime();
    });
    triggerSocketEvent(SOCKET_EVENTS.NOTIFICATION_CREATED, {
      notification: {
        id: "n1",
        type: "MEMBER_LEFT",
        entityId: "org-1",
        message: "Bob left",
        read: false,
        createdAt: new Date(),
      },
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("does not invalidate org caches for a non-MEMBER_LEFT notification", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useGlobalRealtime();
    });
    triggerSocketEvent(SOCKET_EVENTS.NOTIFICATION_CREATED, {
      notification: { id: "n1", message: "Hello", read: false, createdAt: new Date() },
    });
    const utils = getLastMockUtils();
    expect(utils.orgs.members.invalidate).not.toHaveBeenCalled();
    expect(utils.orgs.formerAssignees.invalidate).not.toHaveBeenCalled();
    expect(utils.orgs.assigneeLookup.invalidate).not.toHaveBeenCalled();
    expect(utils.orgs.list.invalidate).not.toHaveBeenCalled();
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
