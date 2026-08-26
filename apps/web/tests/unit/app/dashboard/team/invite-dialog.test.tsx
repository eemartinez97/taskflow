import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { InviteDialog } from "@/app/(dashboard)/team/_components/invite-dialog";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { mockApiUtils, mockUseMutationResult, setupMutationMock } from "@/tests/support/trpc";

describe("InviteDialog", () => {
  it("defaults the role select to MEMBER", () => {
    render(<InviteDialog orgId={VALID_ORG_ID} open onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^role$/i)).toHaveValue("MEMBER");
  });

  it("excludes OWNER from the role options", () => {
    render(<InviteDialog orgId={VALID_ORG_ID} open onClose={vi.fn()} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain("OWNER");
  });

  it("submits invitations.create with the active org, email and role", async () => {
    const { mutateMock } = setupMutationMock(api.invitations.create);
    render(<InviteDialog orgId={VALID_ORG_ID} open onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^email$/i), "new@taskflow.dev");
    await user.selectOptions(screen.getByLabelText(/^role$/i), "ADMIN");
    await user.click(screen.getByRole("button", { name: /send invite/i }));
    expect(mutateMock).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      data: { email: "new@taskflow.dev", role: "ADMIN" },
    });
  });

  it("shows a success toast, invalidates the org's invitation list, resets and closes on success", () => {
    const onClose = vi.fn();
    const invalidateListForOrg = vi.fn();
    mockApiUtils({ invitations: { listForOrg: { invalidate: invalidateListForOrg } } });
    const { triggerSuccess } = setupMutationMock(api.invitations.create);
    render(<InviteDialog orgId={VALID_ORG_ID} open onClose={onClose} />);

    act(() => {
      triggerSuccess();
    });

    expect(toast.success).toHaveBeenCalledWith("Invitation sent.");
    expect(invalidateListForOrg).toHaveBeenCalledWith({ orgId: VALID_ORG_ID });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the mutation error inline", () => {
    mockUseMutationResult(api.invitations.create, {
      isError: true,
      error: new Error("This person is already a member."),
    });
    render(<InviteDialog orgId={VALID_ORG_ID} open onClose={vi.fn()} />);
    expect(screen.getByText("This person is already a member.")).toBeInTheDocument();
  });

  it("calls onClose when the Close button is clicked", async () => {
    const onClose = vi.fn();
    render(<InviteDialog orgId={VALID_ORG_ID} open onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
