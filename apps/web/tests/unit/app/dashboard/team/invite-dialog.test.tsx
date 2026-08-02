import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { InviteDialog } from "@/app/(dashboard)/team/_components/invite-dialog";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { mockUseMutationResult, setupMutationMock } from "@/tests/support/trpc";

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

  it("submits invite with orgId and { email, role }", async () => {
    const { mutateMock } = setupMutationMock(api.orgs.invite);
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

  it("shows a success toast, resets and closes on success", () => {
    const onClose = vi.fn();
    const { triggerSuccess } = setupMutationMock(api.orgs.invite);
    render(<InviteDialog orgId={VALID_ORG_ID} open onClose={onClose} />);

    act(() => {
      triggerSuccess();
    });

    expect(toast.success).toHaveBeenCalledWith("Invitation sent.");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the mutation error inline", () => {
    mockUseMutationResult(api.orgs.invite, {
      isError: true,
      error: new Error("User already invited."),
    });
    render(<InviteDialog orgId={VALID_ORG_ID} open onClose={vi.fn()} />);
    expect(screen.getByText("User already invited.")).toBeInTheDocument();
  });
});
