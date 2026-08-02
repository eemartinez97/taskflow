import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import type { Org } from "@taskflow/database";
import { EditOrgDialog } from "@/app/(dashboard)/organizations/_components/edit-org-dialog";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation, mockMutationError } from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";

// @taskflow/ui, @/lib/trpc/client and @/lib/toast/store are mocked globally
// in tests/setup/integration.ui.ts.

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
const mockOnClose = vi.fn();
let mockInvalidateOrgsList: ReturnType<typeof vi.fn>;
let updateMutation: ReturnType<typeof wireCapturableMutation>;

function buildProps(overrides: { open?: boolean; org?: Org } = {}) {
  return {
    org: MOCK_ORG,
    open: true,
    onClose: mockOnClose,
    ...overrides,
  };
}

// -- Tests --
describe("EditOrgDialog", () => {
  beforeEach(() => {
    mockInvalidateOrgsList = vi.fn();
    mockApiUtils({ orgs: { list: { invalidate: mockInvalidateOrgsList } } });
    updateMutation = wireCapturableMutation(api.orgs.update);
  });

  // -- Rendering --

  it("does not render when open is false", () => {
    renderUI(<EditOrgDialog {...buildProps({ open: false })} />);
    expect(screen.queryByText("Edit organization")).not.toBeInTheDocument();
  });

  it("renders the dialog title when open is true", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);
    expect(screen.getByText("Edit organization")).toBeInTheDocument();
  });

  it("pre-fills the Name field with the org's current name", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);
    expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument();
  });

  it("pre-fills the Slug field with the org's current slug", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);

    expect(screen.getByDisplayValue("acme-corp")).toBeInTheDocument();
  });

  it("renders the Save and Cancel buttons", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // -- Form re-sync on open --

  it("resets the form to a new org's values when the dialog reopens with a different org", () => {
    const differentOrg: Org = {
      ...MOCK_ORG,
      id: "org-uuid-2",
      name: "Globex",
      slug: "globex",
    };
    const { rerender } = renderUI(<EditOrgDialog {...buildProps({ open: false })} />);
    rerender(<EditOrgDialog org={differentOrg} open={true} onClose={mockOnClose} />);
    expect(screen.getByDisplayValue("Globex")).toBeInTheDocument();
    expect(screen.getByDisplayValue("globex")).toBeInTheDocument();
  });

  // -- Form submission --

  it("calls mutation.mutate with orgId and the updated form values on submit", async () => {
    renderUI(<EditOrgDialog {...buildProps()} />);

    fireEvent.change(screen.getByDisplayValue("Acme Corp"), {
      target: { value: UPDATED_ORG_DATA.name },
    });
    fireEvent.change(screen.getByDisplayValue("acme-corp"), {
      target: { value: UPDATED_ORG_DATA.slug },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

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

  // -- Success side effects --

  it("shows a success toast on mutation success", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);
    updateMutation.simulateSuccess();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Organization updated.");
  });

  it("invalidates orgs.list on mutation success", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);
    updateMutation.simulateSuccess();
    expect(mockInvalidateOrgsList).toHaveBeenCalled();
  });

  it("calls onClose on mutation success", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);
    updateMutation.simulateSuccess();
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  // -- Error display --

  it("shows the inline error message when the mutation is in error state", () => {
    const errorText = "Organization name already taken.";
    mockMutationError(api.orgs.update, updateMutation, errorText);
    renderUI(<EditOrgDialog {...buildProps()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  it("does NOT render an alert when there is no mutation error", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -- Cancel behavior --

  it("calls onClose when the Cancel button is clicked", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("resets the mutation state when Cancel is clicked", () => {
    renderUI(<EditOrgDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(updateMutation.reset).toHaveBeenCalledOnce();
  });
});
