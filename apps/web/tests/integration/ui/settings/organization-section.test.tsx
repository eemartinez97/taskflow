import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { Org } from "@taskflow/database";
import { OrganizationSection } from "@/app/(dashboard)/settings/_components/organization-section";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation, mockMutationError } from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

// @taskflow/ui, @/lib/trpc/client and @/lib/toast/store are mocked globally
// in tests/setup/integration.ui.ts.

vi.mock("@/lib/utils/active-org", () => ({ clearActiveOrgId: vi.fn() }));

// Stub ConfirmDialog - it has its own dedicated test file, same convention
// as the other Team/Settings integration tests (members-section,
// invitations-section).
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
        <button onClick={onConfirm}>Confirm delete</button>
        <button onClick={onClose}>Cancel delete</button>
      </div>
    ) : null,
}));

// -- Fixtures --
const MOCK_ORG: Org = {
  id: "org-uuid-1",
  name: "Acme Corp",
  slug: "acme-corp",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const UPDATED_ORG_DATA = { name: "Acme Corp Renamed", slug: "acme-corp-renamed" };

// -- Helpers --
let mockInvalidateOrgsList: ReturnType<typeof vi.fn>;
let updateMutation: ReturnType<typeof wireCapturableMutation>;
let deleteMutation: ReturnType<typeof wireCapturableMutation>;

// -- Tests --
describe("OrganizationSection", () => {
  const { router } = setupRouterMock();

  beforeEach(() => {
    mockInvalidateOrgsList = vi.fn();
    mockApiUtils({ orgs: { list: { invalidate: mockInvalidateOrgsList } } });
    updateMutation = wireCapturableMutation(api.orgs.update);
    deleteMutation = wireCapturableMutation(api.orgs.delete);
  });

  // -- Rendering --

  it("renders the Organization heading", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);
    expect(screen.getByText("Organization")).toBeInTheDocument();
  });

  it("pre-fills the Name field with the org's current name", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);
    expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument();
  });

  it("pre-fills the Slug field with the org's current slug", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);
    expect(screen.getByDisplayValue("acme-corp")).toBeInTheDocument();
  });

  // -- Rename form submission --

  it("calls the update mutation with orgId and the updated form values on submit", async () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);

    fireEvent.change(screen.getByDisplayValue("Acme Corp"), {
      target: { value: UPDATED_ORG_DATA.name },
    });
    fireEvent.change(screen.getByDisplayValue("acme-corp"), {
      target: { value: UPDATED_ORG_DATA.slug },
    });
    fireEvent.click(screen.getByRole("button", { name: /save organization/i }));

    await waitFor(() => {
      expect(updateMutation.mutate).toHaveBeenCalledWith({
        orgId: MOCK_ORG.id,
        data: expect.objectContaining({
          name: UPDATED_ORG_DATA.name,
          slug: UPDATED_ORG_DATA.slug,
        }) as unknown,
      });
    });
  });

  it("shows a success toast, invalidates orgs.list and refreshes on update success", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);
    updateMutation.simulateSuccess();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Organization updated.");
    expect(mockInvalidateOrgsList).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows the inline error message when the update mutation is in error state", () => {
    const errorText = "Organization name already taken.";
    mockMutationError(api.orgs.update, updateMutation, errorText);
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  // -- Danger zone visibility --

  it("shows the danger zone for OWNER", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);
    expect(screen.getByRole("button", { name: /delete organization/i })).toBeInTheDocument();
  });

  it("hides the danger zone for ADMIN", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="ADMIN" />);
    expect(screen.queryByRole("button", { name: /delete organization/i })).not.toBeInTheDocument();
  });

  // -- Delete flow --

  it("opens ConfirmDialog when Delete organization is clicked", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);
    fireEvent.click(screen.getByRole("button", { name: /delete organization/i }));

    const dialog = screen.getByTestId("confirm-dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Delete organization")).toBeInTheDocument();
  });

  it("calls delete mutation with the orgId when confirmed", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);
    fireEvent.click(screen.getByRole("button", { name: /delete organization/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith({ orgId: MOCK_ORG.id });
  });

  it("closes ConfirmDialog without deleting when cancelled", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);
    fireEvent.click(screen.getByRole("button", { name: /delete organization/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    expect(deleteMutation.mutate).not.toHaveBeenCalled();
  });

  it("clears the active org, invalidates orgs.list, refreshes and toasts on delete success", () => {
    renderUI(<OrganizationSection org={MOCK_ORG} role="OWNER" />);

    deleteMutation.simulateSuccess();

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Organization deleted.");
    expect(mockInvalidateOrgsList).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });
});
