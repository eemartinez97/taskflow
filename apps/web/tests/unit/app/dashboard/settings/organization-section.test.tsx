import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/active-org", () => ({ clearActiveOrgId: vi.fn() }));

vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: (props: { open: boolean; onConfirm: () => void; onClose: () => void }) =>
    props.open ? (
      <>
        <button onClick={props.onConfirm}>Confirm Delete</button>
        <button onClick={props.onClose}>Cancel Delete</button>
      </>
    ) : null,
}));

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { OrganizationSection } from "@/app/(dashboard)/settings/_components/organization-section";
import { clearActiveOrgId } from "@/lib/utils/active-org";
import { makeOrg } from "@/tests/support/factories";
import { mockApiUtils, mockUseMutationResult, setupMutationMock } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

const org = makeOrg({ name: "Acme Corp", slug: "acme-corp" });

describe("OrganizationSection", () => {
  it("pre-fills the form with the org's current name and slug", () => {
    render(<OrganizationSection org={org} role="OWNER" />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Acme Corp");
    expect(screen.getByLabelText(/^slug$/i)).toHaveValue("acme-corp");
  });

  it("submits the update mutation with orgId and the form data", async () => {
    const { mutateMock } = setupMutationMock(api.orgs.update);
    render(<OrganizationSection org={org} role="OWNER" />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), "Renamed Org");
    await user.click(screen.getByRole("button", { name: /save organization/i }));
    expect(mutateMock).toHaveBeenCalledWith({
      orgId: org.id,
      data: { name: "Renamed Org", slug: "acme-corp" },
    });
  });

  it("shows a success toast, invalidates orgs.list and refreshes when the update succeeds", () => {
    const invalidateOrgsList = vi.fn();
    mockApiUtils({ orgs: { list: { invalidate: invalidateOrgsList } } });
    const { refreshMock } = setupRouterMock();
    const { triggerSuccess } = setupMutationMock(api.orgs.update);
    render(<OrganizationSection org={org} role="OWNER" />);

    act(() => {
      triggerSuccess();
    });

    expect(toast.success).toHaveBeenCalledWith("Organization updated.");
    expect(invalidateOrgsList).toHaveBeenCalled();
    // Keeps the danger zone's copy and delete confirmText gate in sync with
    // the new name - see organization-section.tsx's onSuccess comment.
    expect(refreshMock).toHaveBeenCalled();
  });

  it("renders the update mutation error inline", () => {
    mockUseMutationResult(api.orgs.update, {
      isError: true,
      error: new Error("Slug conflict."),
    });
    render(<OrganizationSection org={org} role="OWNER" />);
    expect(screen.getByText("Slug conflict.")).toBeInTheDocument();
  });

  // -- Danger zone visibility --

  it("shows the danger zone for OWNER", () => {
    render(<OrganizationSection org={org} role="OWNER" />);
    expect(screen.getByRole("button", { name: /delete organization/i })).toBeInTheDocument();
  });

  it("hides the danger zone for ADMIN", () => {
    render(<OrganizationSection org={org} role="ADMIN" />);
    expect(screen.queryByRole("button", { name: /delete organization/i })).not.toBeInTheDocument();
  });

  // -- Delete flow --

  it("requires opening the confirm dialog before deleting", () => {
    const { mutateMock } = setupMutationMock(api.orgs.delete);
    render(<OrganizationSection org={org} role="OWNER" />);

    expect(screen.queryByRole("button", { name: /confirm delete/i })).not.toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("opens the confirm dialog and deletes on confirm", async () => {
    const { mutateMock } = setupMutationMock(api.orgs.delete);
    render(<OrganizationSection org={org} role="OWNER" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /delete organization/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(mutateMock).toHaveBeenCalledWith({ orgId: org.id });
  });

  it("cancels the delete dialog without deleting", async () => {
    const { mutateMock } = setupMutationMock(api.orgs.delete);
    render(<OrganizationSection org={org} role="OWNER" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /delete organization/i }));
    await user.click(screen.getByRole("button", { name: /cancel delete/i }));

    expect(screen.queryByRole("button", { name: /confirm delete/i })).not.toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("clears the active org, invalidates orgs.list, refreshes and shows a toast on delete success", () => {
    const { refreshMock } = setupRouterMock();
    const invalidateOrgsList = vi.fn();
    mockApiUtils({ orgs: { list: { invalidate: invalidateOrgsList } } });
    const { triggerSuccess } = setupMutationMock(api.orgs.delete);
    render(<OrganizationSection org={org} role="OWNER" />);

    act(() => {
      triggerSuccess();
    });

    expect(toast.success).toHaveBeenCalledWith("Organization deleted.");
    expect(clearActiveOrgId).toHaveBeenCalled();
    expect(invalidateOrgsList).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });
});
