import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/common/dropdown-menu", () => ({
  DropdownMenu: ({ items }: { items: { label: string; onClick: () => void }[] }) => (
    <div>
      {items.map((item) => (
        <button key={item.label} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

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

vi.mock("@/app/(dashboard)/projects/_components/create-project-dialog", () => ({
  CreateProjectDialog: ({ open, onCreated }: { open: boolean; onCreated: () => void }) =>
    open ? <button onClick={onCreated}>Create</button> : null,
}));
vi.mock("@/app/(dashboard)/projects/_components/edit-project-dialog", () => ({
  EditProjectDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <button onClick={onClose}>Close Edit</button> : null,
}));

import { api } from "@/lib/trpc/client";
import { ProjectList } from "@/app/(dashboard)/projects/_components/project-list";

import userEvent from "@testing-library/user-event";
import { makeMembership, makeOrg, makeProject } from "@/tests/support/factories";
import { mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { VALID_ORG_ID } from "@/tests/support/fixtures";

describe("ProjectList", () => {
  it("renders empty state and hides create button for VIEWER", () => {
    const org = makeOrg({ memberships: [makeMembership({ role: "VIEWER" })] });
    mockUseQuery(api.projects.list, []);
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={org} initialProjects={[]} />);
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new project/i })).not.toBeInTheDocument();
  });

  it("renders projects and hides admin dropdown for non-admins", () => {
    const org = makeOrg({ memberships: [{ role: "MEMBER" }] });
    const proj = makeProject({ description: "Test desc" });
    mockUseQuery(api.projects.list, [proj]);
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={org} initialProjects={[proj]} />);
    expect(screen.getByText(proj.name)).toBeInTheDocument();
    expect(screen.getByText("Test desc")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /options for/i })).not.toBeInTheDocument();
  });

  it("shows dropdown, edits, and deletes project for OWNER", () => {
    const org = makeOrg({ memberships: [makeMembership({ role: "OWNER" })] });
    const proj = makeProject({ description: null });
    mockUseQuery(api.projects.list, [proj]);
    const { mutateMock } = setupMutationMock(api.projects.delete);

    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={org} initialProjects={[proj]} />);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(mutateMock).toHaveBeenCalledWith({ orgId: VALID_ORG_ID, projectId: proj.id });
  });

  it("shows New Project for a member and opens/closes the create dialog", async () => {
    const org = makeOrg({ memberships: [makeMembership({ role: "MEMBER" })] });
    mockUseQuery(api.projects.list, []);
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={org} initialProjects={[]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /new project/i }));
    await user.click(screen.getByText("Create"));
    expect(screen.queryByText("Create")).not.toBeInTheDocument();
  });

  it("opens and closes the edit dialog for an OWNER", async () => {
    const org = makeOrg({ memberships: [makeMembership({ role: "OWNER" })] });
    const proj = makeProject();
    mockUseQuery(api.projects.list, [proj]);
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={org} initialProjects={[proj]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("Close Edit")).toBeInTheDocument();
    await user.click(screen.getByText("Close Edit"));
    expect(screen.queryByText("Close Edit")).not.toBeInTheDocument();
  });

  it("invalidates and clears deleteTarget when the delete mutation succeeds", () => {
    const org = makeOrg({ memberships: [makeMembership({ role: "OWNER" })] });
    const proj = makeProject();
    mockUseQuery(api.projects.list, [proj]);
    const { triggerSuccess } = setupMutationMock(api.projects.delete);
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={org} initialProjects={[proj]} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    act(() => {
      triggerSuccess();
    });

    expect(screen.queryByRole("button", { name: /confirm delete/i })).not.toBeInTheDocument();
  });

  it("cancels the delete confirmation without deleting", async () => {
    const org = makeOrg({ memberships: [makeMembership({ role: "OWNER" })] });
    const proj = makeProject();
    mockUseQuery(api.projects.list, [proj]);
    const { mutateMock } = setupMutationMock(api.projects.delete);
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={org} initialProjects={[proj]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await user.click(screen.getByRole("button", { name: /cancel delete/i }));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("defaults to VIEWER permissions when initialOrg has no memberships", () => {
    const org = makeOrg({ memberships: [] });
    mockUseQuery(api.projects.list, []);
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={org} initialProjects={[]} />);
    expect(screen.queryByRole("button", { name: /new project/i })).not.toBeInTheDocument();
  });

  it("does nothing when onConfirm fires without a deleteTarget", () => {
    const org = makeOrg({ memberships: [makeMembership({ role: "OWNER" })] });
    mockUseQuery(api.projects.list, []);
    const { mutateMock } = setupMutationMock(api.projects.delete);
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={org} initialProjects={[]} />);
    capturedConfirmProps.onConfirm?.();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
