import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { InvitationsSection } from "@/app/(dashboard)/organizations/[orgId]/_components/invitations-section";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";
import { makeOrgInvitation } from "@/tests/support/factories";

vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onClose,
    title,
  }: {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
    title: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm revoke</button>
        <button onClick={onClose}>Cancel revoke</button>
      </div>
    ) : null,
}));

let mockInvalidateListForOrg: ReturnType<typeof vi.fn>;
let resendMutation: ReturnType<typeof wireCapturableMutation>;
let revokeMutation: ReturnType<typeof wireCapturableMutation>;

const PENDING = makeOrgInvitation({ id: "inv-1", email: "bob@taskflow.dev", status: "PENDING" });

describe("InvitationsSection", () => {
  beforeEach(() => {
    mockInvalidateListForOrg = vi.fn();
    mockApiUtils({ invitations: { listForOrg: { invalidate: mockInvalidateListForOrg } } });
    resendMutation = wireCapturableMutation(api.invitations.resend);
    revokeMutation = wireCapturableMutation(api.invitations.revoke);
    mockUseQuery(api.invitations.listForOrg, [PENDING]);
  });

  it("renders the invitation row", () => {
    renderUI(<InvitationsSection orgId="org-1" initialInvitations={[]} />);

    expect(screen.getByText("bob@taskflow.dev")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("calls resend with the org and invitation id", () => {
    renderUI(<InvitationsSection orgId="org-1" initialInvitations={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /resend invitation to bob@taskflow.dev/i }));

    expect(resendMutation.mutate).toHaveBeenCalledWith({ orgId: "org-1", invitationId: "inv-1" });
  });

  it("shows a success toast and invalidates the list after a successful resend", () => {
    renderUI(<InvitationsSection orgId="org-1" initialInvitations={[]} />);

    act(() => {
      resendMutation.simulateSuccess();
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Invitation resent.");
    expect(mockInvalidateListForOrg).toHaveBeenCalledWith({ orgId: "org-1" });
  });

  it("opens a ConfirmDialog and revokes on confirm", () => {
    renderUI(<InvitationsSection orgId="org-1" initialInvitations={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /revoke invitation to bob@taskflow.dev/i }));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
    expect(revokeMutation.mutate).toHaveBeenCalledWith({ orgId: "org-1", invitationId: "inv-1" });
  });

  it("closes the ConfirmDialog without revoking when cancelled", () => {
    renderUI(<InvitationsSection orgId="org-1" initialInvitations={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /revoke invitation to bob@taskflow.dev/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel revoke" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    expect(revokeMutation.mutate).not.toHaveBeenCalled();
  });

  it("shows a success toast and invalidates the list after a successful revoke", () => {
    renderUI(<InvitationsSection orgId="org-1" initialInvitations={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /revoke invitation to bob@taskflow.dev/i }));

    act(() => {
      revokeMutation.simulateSuccess();
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Invitation revoked.");
    expect(mockInvalidateListForOrg).toHaveBeenCalledWith({ orgId: "org-1" });
  });
});
