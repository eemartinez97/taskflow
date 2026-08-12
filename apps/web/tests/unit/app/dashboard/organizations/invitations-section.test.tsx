import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

let capturedConfirmProps: { onConfirm?: () => void; onClose?: () => void } = {};
vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: (props: {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
    description: string;
  }) => {
    capturedConfirmProps = props;
    return props.open ? (
      <>
        <p>{props.description}</p>
        <button onClick={props.onConfirm}>Confirm Revoke</button>
        <button onClick={props.onClose}>Cancel Revoke</button>
      </>
    ) : null;
  },
}));

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { InvitationsSection } from "@/app/(dashboard)/organizations/[orgId]/_components/invitations-section";
import { mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { makeOrgInvitation } from "@/tests/support/factories";
import { VALID_ORG_ID } from "@/tests/support/fixtures";

describe("InvitationsSection", () => {
  it("renders the invitation count heading", () => {
    mockUseQuery(api.invitations.listForOrg, [makeOrgInvitation()]);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    expect(screen.getByText("Invitations (1)")).toBeInTheDocument();
  });

  it("shows an empty state when there are no invitations", () => {
    mockUseQuery(api.invitations.listForOrg, []);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    expect(screen.getByText(/no invitations sent yet/i)).toBeInTheDocument();
  });

  it("renders the invitee email, role, and inviter", () => {
    mockUseQuery(api.invitations.listForOrg, [
      makeOrgInvitation({ email: "bob@example.com", role: "ADMIN", inviterName: "Alice" }),
    ]);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByText(/invited by alice/i)).toBeInTheDocument();
  });

  it("falls back to 'someone' when the inviter is unknown", () => {
    mockUseQuery(api.invitations.listForOrg, [makeOrgInvitation({ inviterName: null })]);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    expect(screen.getByText(/invited by someone/i)).toBeInTheDocument();
  });

  it("renders PENDING status as-is when not expired", () => {
    mockUseQuery(api.invitations.listForOrg, [
      makeOrgInvitation({ status: "PENDING", expiresAt: new Date("2099-01-01") }),
    ]);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("renders an expired PENDING invitation as EXPIRED", () => {
    mockUseQuery(api.invitations.listForOrg, [
      makeOrgInvitation({ status: "PENDING", expiresAt: new Date("2020-01-01") }),
    ]);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    expect(screen.getByText("EXPIRED")).toBeInTheDocument();
    expect(screen.queryByText("PENDING")).not.toBeInTheDocument();
  });

  it("renders a non-PENDING status without deriving EXPIRED", () => {
    mockUseQuery(api.invitations.listForOrg, [
      makeOrgInvitation({ status: "ACCEPTED", expiresAt: new Date("2020-01-01") }),
    ]);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    expect(screen.getByText("ACCEPTED")).toBeInTheDocument();
  });

  it("shows resend/revoke actions only for PENDING rows", () => {
    mockUseQuery(api.invitations.listForOrg, [
      makeOrgInvitation({ id: "inv-pending", status: "PENDING", email: "pending@x.com" }),
      makeOrgInvitation({ id: "inv-accepted", status: "ACCEPTED", email: "accepted@x.com" }),
    ]);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    expect(
      screen.getByRole("button", { name: /resend invitation to pending@x.com/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /resend invitation to accepted@x.com/i }),
    ).not.toBeInTheDocument();
  });

  it("calls the resend mutation with orgId and invitationId", async () => {
    mockUseQuery(api.invitations.listForOrg, [
      makeOrgInvitation({ id: "inv-1", email: "bob@example.com" }),
    ]);
    const { mutateMock } = setupMutationMock(api.invitations.resend);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /resend invitation to bob@example.com/i }));
    expect(mutateMock).toHaveBeenCalledWith({ orgId: VALID_ORG_ID, invitationId: "inv-1" });
  });

  it("shows a success toast and invalidates the list when resend succeeds", () => {
    mockUseQuery(api.invitations.listForOrg, [makeOrgInvitation()]);
    const { triggerSuccess } = setupMutationMock(api.invitations.resend);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    act(() => {
      triggerSuccess();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Invitation resent.");
  });

  it("opens a ConfirmDialog on revoke click and revokes on confirm", async () => {
    mockUseQuery(api.invitations.listForOrg, [
      makeOrgInvitation({ id: "inv-1", email: "bob@example.com" }),
    ]);
    const { mutateMock } = setupMutationMock(api.invitations.revoke);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /revoke invitation to bob@example.com/i }));
    expect(screen.getByText(/revoke the invitation sent to bob@example.com/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm revoke/i }));
    expect(mutateMock).toHaveBeenCalledWith({ orgId: VALID_ORG_ID, invitationId: "inv-1" });
  });

  it("closes the revoke confirmation without revoking when cancelled", async () => {
    mockUseQuery(api.invitations.listForOrg, [makeOrgInvitation({ email: "bob@example.com" })]);
    const { mutateMock } = setupMutationMock(api.invitations.revoke);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /revoke invitation to bob@example.com/i }));
    await user.click(screen.getByRole("button", { name: /cancel revoke/i }));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("shows a success toast, invalidates, and clears the target when revoke succeeds", () => {
    mockUseQuery(api.invitations.listForOrg, [makeOrgInvitation()]);
    const { triggerSuccess } = setupMutationMock(api.invitations.revoke);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    act(() => {
      triggerSuccess();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Invitation revoked.");
  });

  it("does nothing when onConfirm fires without a revokeTarget", () => {
    mockUseQuery(api.invitations.listForOrg, []);
    const { mutateMock } = setupMutationMock(api.invitations.revoke);
    render(<InvitationsSection orgId={VALID_ORG_ID} initialInvitations={[]} />);
    capturedConfirmProps.onConfirm?.();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
