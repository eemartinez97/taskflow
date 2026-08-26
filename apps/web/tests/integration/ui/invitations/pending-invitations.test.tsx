import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { PendingInvitations } from "@/components/invitations/pending-invitations";
import { api } from "@/lib/trpc/client";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import { makeMyInvitation } from "@/tests/support/factories";

vi.mock("@/lib/utils/active-org", () => ({ setActiveOrgId: vi.fn() }));

import { setActiveOrgId } from "@/lib/utils/active-org";

let acceptMutation: ReturnType<typeof wireCapturableMutation>;
let declineMutation: ReturnType<typeof wireCapturableMutation>;

describe("PendingInvitations", () => {
  beforeEach(() => {
    setupRouterMock();
    mockApiUtils();
    acceptMutation = wireCapturableMutation(api.invitations.accept);
    declineMutation = wireCapturableMutation(api.invitations.decline);
    mockUseQuery(api.invitations.listMine, [
      makeMyInvitation({ id: "inv-1", orgName: "Acme", role: "MEMBER" }),
    ]);
  });

  it("renders the shared EmptyState when there are no pending invitations", () => {
    mockUseQuery(api.invitations.listMine, []);
    renderUI(<PendingInvitations />);
    expect(screen.getByText("No pending invitations")).toBeInTheDocument();
  });

  it("renders the org name and role", () => {
    renderUI(<PendingInvitations />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("MEMBER")).toBeInTheDocument();
  });

  it("calls the accept mutation with the invitation id on Accept click", () => {
    renderUI(<PendingInvitations />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(acceptMutation.mutate).toHaveBeenCalledWith({ invitationId: "inv-1" });
  });

  it("sets the active org on a successful accept", () => {
    renderUI(<PendingInvitations />);
    act(() => {
      acceptMutation.simulateSuccess({ orgId: "org-42", membership: {} });
    });
    expect(setActiveOrgId).toHaveBeenCalledWith("org-42");
  });

  it("calls the decline mutation with the invitation id on Decline click", () => {
    renderUI(<PendingInvitations />);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(declineMutation.mutate).toHaveBeenCalledWith({ invitationId: "inv-1" });
  });
});
