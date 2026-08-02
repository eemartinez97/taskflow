import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CreateProjectDialog } from "@/app/(dashboard)/projects/_components/create-project-dialog";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { deriveProjectKey, deriveSlug } from "@/lib/utils/derive";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation, mockMutationError } from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";

// -- Fixtures --
const ORG_ID = "org-abc-123";
const MOCK_PROJECT = {
  id: "proj-new-1",
  name: "Website Revamp",
  key: "WR",
  slug: "website-revamp",
  orgId: ORG_ID,
};

// -- Helpers --
const mockOnClose = vi.fn();
const mockOnCreated = vi.fn();
let mockInvalidateProjectsList: ReturnType<typeof vi.fn>;
let createMutation: ReturnType<typeof wireCapturableMutation>;

function buildProps(overrides: { open?: boolean } = {}) {
  return {
    orgId: ORG_ID,
    open: true,
    onClose: mockOnClose,
    onCreated: mockOnCreated,
    ...overrides,
  };
}

// -- Tests --
describe("CreateProjectDialog", () => {
  beforeEach(() => {
    mockInvalidateProjectsList = vi.fn();
    mockApiUtils({ projects: { list: { invalidate: mockInvalidateProjectsList } } });
    createMutation = wireCapturableMutation(api.projects.create);
  });

  // -- Rendering --

  it("does not render when open is false", () => {
    renderUI(<CreateProjectDialog {...buildProps({ open: false })} />);

    expect(screen.queryByText("Create Project")).not.toBeInTheDocument();
  });

  it("renders the dialog title when open is true", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    expect(screen.getByText("Create Project")).toBeInTheDocument();
  });

  it("renders Name, Key, and Slug fields empty on open", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Key")).toHaveValue("");
    expect(screen.getByLabelText("Slug")).toHaveValue("");
  });

  it("renders Create and Cancel footer buttons", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // -- Auto-derivation --

  it("auto-derives the Key from the name while the Key field is untouched", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Website Revamp" },
    });

    expect(screen.getByLabelText("Key")).toHaveValue(deriveProjectKey("Website Revamp"));
  });

  it("auto-derives the Slug from the name while the Slug field is untouched", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Website Revamp" },
    });

    expect(screen.getByLabelText("Slug")).toHaveValue(deriveSlug("Website Revamp"));
  });

  it("stops overwriting the Key after the user edits it directly", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    // User manually edits Key -> marks it dirty
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "CUSTOM" } });

    // Now typing a new name must NOT change the Key
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Something Else" } });

    expect(screen.getByLabelText("Key")).toHaveValue("CUSTOM");
  });

  it("stops overwriting the Slug after the user edits it directly", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "my-custom-slug" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Something Else" } });

    expect(screen.getByLabelText("Slug")).toHaveValue("my-custom-slug");
  });

  // -- Form submission --

  it("calls mutation.mutate with orgId and form data on submit", async () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Website Revamp" } });
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "WR" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "website-revamp" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(createMutation.mutate).toHaveBeenCalledWith({
        orgId: ORG_ID,
        data: expect.objectContaining({
          name: "Website Revamp",
          key: "WR",
          slug: "website-revamp",
        }) as unknown,
      });
    });
  });

  it("shows validation errors and does NOT call mutate when fields are empty", async () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  // -- Success side effects --

  it("shows a success toast on mutation success", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_PROJECT);
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Project created.");
  });

  it("invalidates projects.list on mutation success", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_PROJECT);
    });

    expect(mockInvalidateProjectsList).toHaveBeenCalled();
  });

  it("calls onCreated on mutation success", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_PROJECT);
    });

    expect(mockOnCreated).toHaveBeenCalledOnce();
  });

  it("calls onClose on mutation success", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_PROJECT);
    });

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  // -- Error display --

  it("shows the inline error alert when the mutation is in error state", () => {
    const errorText = "Project key already in use.";
    mockMutationError(api.projects.create, createMutation, errorText);
    renderUI(<CreateProjectDialog {...buildProps()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  it("does NOT render an alert when there is no mutation error", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -- Cancel behavior --

  it("calls onClose when Cancel is clicked", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("resets the mutation state when Cancel is clicked", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createMutation.reset).toHaveBeenCalledOnce();
  });

  it("does NOT call onCreated when Cancel is clicked", () => {
    renderUI(<CreateProjectDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockOnCreated).not.toHaveBeenCalled();
  });
});
