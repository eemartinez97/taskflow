import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/active-org", () => ({ clearActiveOrgId: vi.fn() }));

vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: (props: { open: boolean; onConfirm: () => void; onClose: () => void }) =>
    props.open ? (
      <>
        <button onClick={props.onConfirm}>Confirm Leave</button>
        <button onClick={props.onClose}>Cancel Leave</button>
      </>
    ) : null,
}));

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { LeaveOrgSection } from "@/app/(dashboard)/settings/_components/leave-org-section";
import { clearActiveOrgId } from "@/lib/utils/active-org";
import { mockApiUtils, setupMutationMock } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import { VALID_ORG_ID } from "@/tests/support/fixtures";

describe("LeaveOrgSection", () => {
  it("shows an explanatory message instead of a button for the OWNER", () => {
    render(<LeaveOrgSection orgId={VALID_ORG_ID} orgName="Acme" role="OWNER" />);

    expect(screen.getByText(/as the owner, you can't leave acme/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave" })).not.toBeInTheDocument();
  });

  it.each(["ADMIN", "MEMBER", "VIEWER"] as const)("shows the leave button for %s", (role) => {
    render(<LeaveOrgSection orgId={VALID_ORG_ID} orgName="Acme" role={role} />);

    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
  });

  it("requires opening the confirm dialog before leaving", () => {
    const { mutateMock } = setupMutationMock(api.orgs.leave);
    render(<LeaveOrgSection orgId={VALID_ORG_ID} orgName="Acme" role="MEMBER" />);

    expect(screen.queryByRole("button", { name: /confirm leave/i })).not.toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("opens the confirm dialog and leaves on confirm", async () => {
    const { mutateMock } = setupMutationMock(api.orgs.leave);
    render(<LeaveOrgSection orgId={VALID_ORG_ID} orgName="Acme" role="MEMBER" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Leave" }));
    await user.click(screen.getByRole("button", { name: /confirm leave/i }));

    expect(mutateMock).toHaveBeenCalledWith({ orgId: VALID_ORG_ID });
  });

  it("cancels the leave dialog without leaving", async () => {
    const { mutateMock } = setupMutationMock(api.orgs.leave);
    render(<LeaveOrgSection orgId={VALID_ORG_ID} orgName="Acme" role="MEMBER" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Leave" }));
    await user.click(screen.getByRole("button", { name: /cancel leave/i }));

    expect(screen.queryByRole("button", { name: /confirm leave/i })).not.toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("clears the active org, invalidates orgs.list, navigates to /projects and shows a toast on success", () => {
    const { pushMock } = setupRouterMock();
    const invalidateOrgsList = vi.fn();
    mockApiUtils({ orgs: { list: { invalidate: invalidateOrgsList } } });
    const { triggerSuccess } = setupMutationMock(api.orgs.leave);
    render(<LeaveOrgSection orgId={VALID_ORG_ID} orgName="Acme" role="MEMBER" />);

    act(() => {
      triggerSuccess();
    });

    expect(toast.success).toHaveBeenCalledWith("You left Acme.");
    expect(clearActiveOrgId).toHaveBeenCalled();
    expect(invalidateOrgsList).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/projects");
  });
});
