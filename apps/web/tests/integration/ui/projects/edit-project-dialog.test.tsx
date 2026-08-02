import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import type { Project } from "@taskflow/database";
import { EditProjectDialog } from "@/app/(dashboard)/projects/_components/edit-project-dialog";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation, mockMutationError } from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";

// -- Fixtures --
const ORG_ID = "org-abc-123";

const PROJECT: Project = {
  id: "proj-uuid-1",
  name: "Website Revamp",
  key: "WR",
  slug: "website-revamp",
  description: null,
  orgId: ORG_ID,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const DIFFERENT_PROJECT: Project = {
  ...PROJECT,
  id: "proj-uuid-2",
  name: "API Overhaul",
  key: "AO",
  slug: "api-overhaul",
};

// -- Helpers --
const mockOnClose = vi.fn();
let mockInvalidateProjectsList: ReturnType<typeof vi.fn>;
let updateMutation: ReturnType<typeof wireCapturableMutation>;

function buildProps(overrides: { open?: boolean; project?: Project } = {}) {
  return {
    project: PROJECT,
    orgId: ORG_ID,
    open: true,
    onClose: mockOnClose,
    ...overrides,
  };
}

// -- Tests --
describe("EditProjectDialog", () => {
  beforeEach(() => {
    mockInvalidateProjectsList = vi.fn();
    mockApiUtils({ projects: { list: { invalidate: mockInvalidateProjectsList } } });
    updateMutation = wireCapturableMutation(api.projects.update);
  });

  // -- Rendering --

  it("does not render when open is false", () => {
    renderUI(<EditProjectDialog {...buildProps({ open: false })} />);

    expect(screen.queryByText("Edit Project")).not.toBeInTheDocument();
  });

  it("renders the dialog title when open is true", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);

    expect(screen.getByText("Edit Project")).toBeInTheDocument();
  });

  it("pre-fills the Name field with the project's current name", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);

    expect(screen.getByDisplayValue("Website Revamp")).toBeInTheDocument();
  });

  it("pre-fills the Key field with the project's current key", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);

    expect(screen.getByDisplayValue("WR")).toBeInTheDocument();
  });

  it("pre-fills the Slug field with the project's current slug", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);

    expect(screen.getByDisplayValue("website-revamp")).toBeInTheDocument();
  });

  it("renders Save and Cancel buttons", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // -- Form re-sync on project change --

  it("resets to the new project's values when the project prop changes while open", () => {
    const { rerender } = renderUI(<EditProjectDialog {...buildProps()} />);

    rerender(
      <EditProjectDialog
        project={DIFFERENT_PROJECT}
        orgId={ORG_ID}
        open={true}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByDisplayValue("API Overhaul")).toBeInTheDocument();
    expect(screen.getByDisplayValue("AO")).toBeInTheDocument();
    expect(screen.getByDisplayValue("api-overhaul")).toBeInTheDocument();
  });

  it("resets to org values when dialog transitions from closed to open", () => {
    const { rerender } = renderUI(<EditProjectDialog {...buildProps({ open: false })} />);

    rerender(
      <EditProjectDialog project={PROJECT} orgId={ORG_ID} open={true} onClose={mockOnClose} />,
    );

    expect(screen.getByDisplayValue("Website Revamp")).toBeInTheDocument();
  });

  // -- Form submission --

  it("calls mutation.mutate with orgId, projectId and updated data on submit", async () => {
    renderUI(<EditProjectDialog {...buildProps()} />);

    fireEvent.change(screen.getByDisplayValue("Website Revamp"), {
      target: { value: "Website Revamp v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateMutation.mutate).toHaveBeenCalledWith({
        orgId: ORG_ID,
        projectId: PROJECT.id,
        data: expect.objectContaining({ name: "Website Revamp v2" }) as unknown,
      });
    });
  });

  // -- Success side effects --

  it("shows a success toast on mutation success", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);
    updateMutation.simulateSuccess();

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Project updated.");
  });

  it("invalidates projects.list on mutation success", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);
    updateMutation.simulateSuccess();

    expect(mockInvalidateProjectsList).toHaveBeenCalled();
  });

  it("calls onClose on mutation success", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);
    updateMutation.simulateSuccess();

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  // -- Error display --

  it("shows the inline error alert when the mutation is in error state", () => {
    const errorText = "Project slug is already taken.";
    mockMutationError(api.projects.update, updateMutation, errorText);
    renderUI(<EditProjectDialog {...buildProps()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  it("does NOT render an alert when there is no mutation error", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -- Cancel behavior --

  it("calls onClose when Cancel is clicked", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("resets the mutation state when Cancel is clicked", () => {
    renderUI(<EditProjectDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(updateMutation.reset).toHaveBeenCalledOnce();
  });
});
