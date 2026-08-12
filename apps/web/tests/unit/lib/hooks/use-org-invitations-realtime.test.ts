import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/socket/client", () => ({ createSocket: vi.fn() }));

import { SOCKET_EVENTS } from "@taskflow/shared";
import { createSocket } from "@/lib/socket/client";
import { useOrgInvitationsRealtime } from "@/lib/hooks/use-org-invitations-realtime";
import { mockSocket, resetHandlerStore, triggerSocketEvent } from "@/tests/mocks/socket-io-client";
import { getLastMockUtils } from "@/tests/support/trpc";

const ORG_ID = "org-1";

afterEach(() => {
  resetHandlerStore();
});

describe("useOrgInvitationsRealtime", () => {
  it("does nothing when createSocket returns null (SSR)", () => {
    vi.mocked(createSocket).mockReturnValue(null);
    expect(() =>
      renderHook(() => {
        useOrgInvitationsRealtime(ORG_ID);
      }),
    ).not.toThrow();
  });

  it("connects the socket on mount", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useOrgInvitationsRealtime(ORG_ID);
    });
    expect(mockSocket.connect).toHaveBeenCalledOnce();
  });

  it("invalidates listForOrg for a matching-org INVITATION_RESOLVED event", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useOrgInvitationsRealtime(ORG_ID);
    });

    triggerSocketEvent(SOCKET_EVENTS.INVITATION_RESOLVED, {
      invitationId: "inv-1",
      orgId: ORG_ID,
      status: "REVOKED",
    });

    const utils = getLastMockUtils();
    expect(utils.invitations.listForOrg.invalidate).toHaveBeenCalledWith({ orgId: ORG_ID });
    expect(utils.orgs.members.invalidate).not.toHaveBeenCalled();
  });

  it("also invalidates the member roster when the resolution was an accept", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useOrgInvitationsRealtime(ORG_ID);
    });

    triggerSocketEvent(SOCKET_EVENTS.INVITATION_RESOLVED, {
      invitationId: "inv-1",
      orgId: ORG_ID,
      status: "ACCEPTED",
    });

    const utils = getLastMockUtils();
    expect(utils.orgs.members.invalidate).toHaveBeenCalledWith({ orgId: ORG_ID });
  });

  it("ignores events for a different org", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    renderHook(() => {
      useOrgInvitationsRealtime(ORG_ID);
    });

    triggerSocketEvent(SOCKET_EVENTS.INVITATION_RESOLVED, {
      invitationId: "inv-1",
      orgId: "some-other-org",
      status: "REVOKED",
    });

    const utils = getLastMockUtils();
    expect(utils.invitations.listForOrg.invalidate).not.toHaveBeenCalled();
  });

  it("disconnects on unmount", () => {
    vi.mocked(createSocket).mockReturnValue(mockSocket as never);
    const { unmount } = renderHook(() => {
      useOrgInvitationsRealtime(ORG_ID);
    });
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalledOnce();
  });
});
