import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { InviteDialog } from "@/app/(dashboard)/organizations/[orgId]/_components/invite-dialog";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { makeOrg } from "@/tests/support/factories";
import { mockUseMutationResult, mockUseQuery, setupMutationMock } from "@/tests/support/trpc";

const OTHER_ORG_ID = "b0000000-0000-4000-8000-000000000002";

function setOrgs(): void {
  mockUseQuery(api.orgs.list, [
    makeOrg({ id: VALID_ORG_ID, name: "Acme", role: "OWNER" }),
    makeOrg({ id: OTHER_ORG_ID, name: "Globex", role: "ADMIN" }),
    makeOrg({ id: "c0000000-0000-4000-8000-000000000003", name: "NoAccess", role: "VIEWER" }),
  ]);
}

describe("InviteDialog", () => {
  it("defaults the role select to MEMBER", () => {
    setOrgs();
    render(<InviteDialog orgId={VALID_ORG_ID} orgName="Acme" open onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^role$/i)).toHaveValue("MEMBER");
  });

  it("excludes OWNER from the role options", () => {
    setOrgs();
    render(<InviteDialog orgId={VALID_ORG_ID} orgName="Acme" open onClose={vi.fn()} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain("OWNER");
  });

  it("defaults the org select to the current org, and only lists orgs the caller can admin", () => {
    setOrgs();
    render(<InviteDialog orgId={VALID_ORG_ID} orgName="Acme" open onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^organization$/i)).toHaveValue(VALID_ORG_ID);
    expect(screen.getByText("Current (Acme)")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.queryByText("NoAccess")).not.toBeInTheDocument();
  });

  it("renders no org options while the org list query hasn't resolved yet", () => {
    mockUseQuery(api.orgs.list, undefined);
    render(<InviteDialog orgId={VALID_ORG_ID} orgName="Acme" open onClose={vi.fn()} />);
    expect(screen.queryByText("Current (Acme)")).not.toBeInTheDocument();
  });

  it("excludes an org the caller has no membership role for", () => {
    mockUseQuery(api.orgs.list, [makeOrg({ id: VALID_ORG_ID, name: "Acme", memberships: [] })]);
    render(<InviteDialog orgId={VALID_ORG_ID} orgName="Acme" open onClose={vi.fn()} />);
    expect(screen.queryByText("Current (Acme)")).not.toBeInTheDocument();
  });

  it("submits invitations.create with the selected org, email and role", async () => {
    setOrgs();
    const { mutateMock } = setupMutationMock(api.invitations.create);
    render(<InviteDialog orgId={VALID_ORG_ID} orgName="Acme" open onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^email$/i), "new@taskflow.dev");
    await user.selectOptions(screen.getByLabelText(/^role$/i), "ADMIN");
    await user.selectOptions(screen.getByLabelText(/^organization$/i), OTHER_ORG_ID);
    await user.click(screen.getByRole("button", { name: /send invite/i }));
    expect(mutateMock).toHaveBeenCalledWith({
      orgId: OTHER_ORG_ID,
      data: { email: "new@taskflow.dev", role: "ADMIN" },
    });
  });

  it("shows a success toast, invalidates the submitted org's list, resets and closes on success", () => {
    setOrgs();
    const onClose = vi.fn();
    const { triggerSuccess } = setupMutationMock(api.invitations.create);
    render(<InviteDialog orgId={VALID_ORG_ID} orgName="Acme" open onClose={onClose} />);

    act(() => {
      triggerSuccess(undefined, {
        orgId: OTHER_ORG_ID,
        data: { email: "x@x.com", role: "MEMBER" },
      });
    });

    expect(toast.success).toHaveBeenCalledWith("Invitation sent.");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the mutation error inline", () => {
    setOrgs();
    mockUseMutationResult(api.invitations.create, {
      isError: true,
      error: new Error("This person is already a member."),
    });
    render(<InviteDialog orgId={VALID_ORG_ID} orgName="Acme" open onClose={vi.fn()} />);
    expect(screen.getByText("This person is already a member.")).toBeInTheDocument();
  });

  it("calls onClose when the Close button is clicked", async () => {
    setOrgs();
    const onClose = vi.fn();
    render(<InviteDialog orgId={VALID_ORG_ID} orgName="Acme" open onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
