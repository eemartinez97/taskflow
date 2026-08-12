import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/active-org", () => ({ setActiveOrgId: vi.fn() }));

import { api } from "@/lib/trpc/client";
import { setActiveOrgId } from "@/lib/utils/active-org";
import { useInvitationActions } from "@/components/invitations/use-invitation-actions";
import { setupRouterMock } from "@/tests/support/render";
import { mockApiUtils, setupMutationMock } from "@/tests/support/trpc";

describe("useInvitationActions", () => {
  it("exposes accept/decline and their pending state", () => {
    setupRouterMock();
    mockApiUtils();
    setupMutationMock(api.invitations.accept);
    setupMutationMock(api.invitations.decline);

    const { result } = renderHook(() => useInvitationActions());

    expect(typeof result.current.accept).toBe("function");
    expect(typeof result.current.decline).toBe("function");
    expect(result.current.isAccepting).toBe(false);
    expect(result.current.isDeclining).toBe(false);
  });

  it("on accept success: sets the active org, invalidates the shared caches, and refreshes the router", () => {
    const { refreshMock } = setupRouterMock();
    // mockApiUtils() (not the default per-call-fresh-object mock) so the
    // invalidate spies stay the SAME instance across every render -
    // useAppRouter's own useTransition re-renders this hook after
    // triggerSuccess (isPending true -> false settling), so a render-count-
    // sensitive lookup like getLastMockUtils() would grab a later render's
    // brand-new, never-called spies instead of the ones the mutation's
    // onSuccess closure actually called.
    const utils = mockApiUtils();
    const { triggerSuccess } = setupMutationMock(api.invitations.accept);
    setupMutationMock(api.invitations.decline);

    renderHook(() => useInvitationActions());

    act(() => {
      triggerSuccess({ orgId: "org-42", membership: {} });
    });

    expect(setActiveOrgId).toHaveBeenCalledWith("org-42");
    expect(utils.invitations.listMine.invalidate).toHaveBeenCalled();
    expect(utils.orgs.list.invalidate).toHaveBeenCalled();
    expect(utils.notifications.list.invalidate).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("on decline success: invalidates the shared caches and refreshes the router, without touching the active org", () => {
    const { refreshMock } = setupRouterMock();
    const utils = mockApiUtils();
    setupMutationMock(api.invitations.accept);
    const { triggerSuccess } = setupMutationMock(api.invitations.decline);

    renderHook(() => useInvitationActions());

    act(() => {
      triggerSuccess();
    });

    expect(setActiveOrgId).not.toHaveBeenCalled();
    expect(utils.invitations.listMine.invalidate).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });
});
