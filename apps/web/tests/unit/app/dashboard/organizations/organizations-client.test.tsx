import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/active-org", () => ({ clearActiveOrgId: vi.fn(), setActiveOrgId: vi.fn() }));

let capturedConfirmProps: { onConfirm?: () => void } = {};
vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: (props: { open: boolean; onConfirm: () => void; onClose: () => void }) => {
    capturedConfirmProps = props;
    return props.open ? (
      <>
        <button onClick={props.onConfirm}>Confirm Delete</button>
        <button onClick={props.onClose}>Cancel Delete</button>
      </>
    ) : null;
  },
}));

vi.mock("@/components/organizations/create-org-dialog", () => ({
  CreateOrgDialog: ({ open, onCreated }: { open: boolean; onCreated: (id: string) => void }) =>
    open ? (
      <button
        onClick={() => {
          onCreated("new-org-id");
        }}
      >
        Create
      </button>
    ) : null,
}));

vi.mock("@/app/(dashboard)/organizations/_components/edit-org-dialog", () => ({
  EditOrgDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div>
        EditOrgDialog
        <button onClick={onClose}>Close Edit</button>
      </div>
    ) : null,
}));

import { api } from "@/lib/trpc/client";
import { OrganizationsClient } from "@/app/(dashboard)/organizations/_components/organizations-client";
import { clearActiveOrgId, setActiveOrgId } from "@/lib/utils/active-org";
import { makeMembership, makeOrg } from "@/tests/support/factories";
import { mockAuthorizedUser } from "@/tests/support/fixtures";
import { mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

const ownerOrg = makeOrg({ id: "org-1", name: "Owner Org" });
const memberOrg = makeOrg({
  id: "org-2",
  name: "Member Org",
  memberships: [
    makeMembership({ id: "m2", orgId: "org-2", userId: mockAuthorizedUser.id, role: "MEMBER" }),
  ],
});

describe("OrganizationsClient", () => {
  it("renders every org with its role badge", () => {
    mockUseQuery(api.orgs.list, [ownerOrg, memberOrg]);
    render(<OrganizationsClient initialOrgs={[ownerOrg, memberOrg]} />);
    expect(screen.getByText("Owner Org")).toBeInTheDocument();
    expect(screen.getByText("Member Org")).toBeInTheDocument();
  });

  it("opens the create dialog and triggers onCreated", async () => {
    const { refreshMock } = setupRouterMock();
    mockUseQuery(api.orgs.list, [ownerOrg]);
    render(<OrganizationsClient initialOrgs={[ownerOrg]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /new organization/i }));
    await userEvent.setup().click(screen.getByRole("button", { name: /create/i }));
    expect(setActiveOrgId).toHaveBeenCalledWith("new-org-id");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("requires typing the org's name to enable delete and then deletes", () => {
    const { mutateMock, triggerSuccess } = setupMutationMock(api.orgs.delete);
    const { refreshMock } = setupRouterMock();
    mockUseQuery(api.orgs.list, [ownerOrg]);
    render(<OrganizationsClient initialOrgs={[ownerOrg]} />);

    fireEvent.click(screen.getByRole("button", { name: /delete owner org/i }));

    const confirmBtn = screen.getByRole("button", { name: /confirm delete/i });
    fireEvent.click(confirmBtn);

    expect(mutateMock).toHaveBeenCalledWith({ orgId: ownerOrg.id });
    act(() => {
      triggerSuccess(undefined, { orgId: ownerOrg.id });
    });
    expect(clearActiveOrgId).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("opens the edit dialog when the edit button is clicked", async () => {
    mockUseQuery(api.orgs.list, [ownerOrg]);
    render(<OrganizationsClient initialOrgs={[ownerOrg]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /edit owner org/i }));
    expect(screen.getByText("EditOrgDialog")).toBeInTheDocument();
  });

  it("cancels the delete dialog via onClose", async () => {
    mockUseQuery(api.orgs.list, [ownerOrg]);
    render(<OrganizationsClient initialOrgs={[ownerOrg]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /delete owner org/i }));
    await user.click(screen.getByRole("button", { name: /cancel delete/i }));
    expect(screen.queryByRole("button", { name: /confirm delete/i })).not.toBeInTheDocument();
  });

  it("closes the edit dialog", async () => {
    mockUseQuery(api.orgs.list, [ownerOrg]);
    render(<OrganizationsClient initialOrgs={[ownerOrg]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /edit owner org/i }));
    expect(screen.getByText("EditOrgDialog")).toBeInTheDocument();
  });

  it("does nothing when onConfirm fires without a deleteTarget", () => {
    mockUseQuery(api.orgs.list, [ownerOrg]);
    const { mutateMock } = setupMutationMock(api.orgs.delete);
    render(<OrganizationsClient initialOrgs={[ownerOrg]} />);
    capturedConfirmProps.onConfirm?.();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("closes the edit dialog via onClose", async () => {
    mockUseQuery(api.orgs.list, [ownerOrg]);
    render(<OrganizationsClient initialOrgs={[ownerOrg]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /edit owner org/i }));
    expect(screen.getByText("EditOrgDialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close edit/i }));
    expect(screen.queryByText("EditOrgDialog")).not.toBeInTheDocument();
  });

  it("defaults to VIEWER badge when an org has no memberships", () => {
    const orgNoMembership = makeOrg({ id: "org-3", name: "Orphan Org", memberships: [] });
    mockUseQuery(api.orgs.list, [orgNoMembership]);
    render(<OrganizationsClient initialOrgs={[orgNoMembership]} />);
    expect(screen.getByText("VIEWER")).toBeInTheDocument();
  });
});
