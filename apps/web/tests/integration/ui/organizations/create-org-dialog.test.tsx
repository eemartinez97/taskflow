import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CreateOrgDialog } from "@/components/organizations/create-org-dialog";
import { api } from "@/lib/trpc/client";
import { deriveSlug } from "@/lib/utils/derive";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation, mockMutationError } from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";

// -- Fixtures --
const MOCK_NEW_ORG = { id: "new-org-uuid", name: "Acme Corp", slug: "acme-corp" };

// -- Helpers --
const mockOnClose = vi.fn();
const mockOnCreated = vi.fn<(id: string) => void>();
let mockInvalidateOrgsList: ReturnType<typeof vi.fn>;
let createMutation: ReturnType<typeof wireCapturableMutation>;

function buildProps(overrides: { open?: boolean } = {}) {
  return {
    open: true,
    onClose: mockOnClose,
    onCreated: mockOnCreated,
    ...overrides,
  };
}

// -- Tests --
describe("CreateOrgDialog", () => {
  beforeEach(() => {
    mockInvalidateOrgsList = vi.fn();
    mockApiUtils({ orgs: { list: { invalidate: mockInvalidateOrgsList } } });
    createMutation = wireCapturableMutation(api.orgs.create);
  });

  // -- Rendering --

  it("does not render when open is false", () => {
    renderUI(<CreateOrgDialog {...buildProps({ open: false })} />);

    expect(screen.queryByText("Create organization")).not.toBeInTheDocument();
  });

  it("renders the dialog title when open is true", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);

    expect(screen.getByText("Create organization")).toBeInTheDocument();
  });

  it("renders empty Name and Slug fields on open", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);

    expect(screen.getByPlaceholderText("Acme Corp")).toHaveValue("");
    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue("");
  });

  it("renders Create and Cancel buttons", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // -- Slug auto-derivation --

  it("auto-derives the slug from the name while the slug field is untouched", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);
    const nameInput = screen.getByPlaceholderText("Acme Corp");

    fireEvent.change(nameInput, { target: { value: "Acme Corp" } });

    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue(deriveSlug("Acme Corp"));
  });

  it("stops overwriting the slug after the user edits it manually", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);

    // User edits the slug directly - marks it dirty
    const slugInput = screen.getByPlaceholderText("acme-corp");
    fireEvent.change(slugInput, { target: { value: "my-custom-slug" } });

    // Now user types a different name - slug must NOT change
    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Something Else" },
    });

    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue("my-custom-slug");
  });

  // -- Form submission --

  it("calls mutation.mutate with the name and slug from the form", async () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);

    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Acme Corp" },
    });
    fireEvent.change(screen.getByPlaceholderText("acme-corp"), {
      target: { value: "acme-corp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(createMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme Corp", slug: "acme-corp" }),
      );
    });
  });

  it("does NOT call mutate when name is empty", async () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  // -- Success side effects --

  it("calls onCreated with the new org's id on mutation success", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_NEW_ORG);
    });

    expect(mockOnCreated).toHaveBeenCalledWith(MOCK_NEW_ORG.id);
  });

  it("invalidates orgs.list on mutation success", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_NEW_ORG);
    });

    expect(mockInvalidateOrgsList).toHaveBeenCalled();
  });

  // -- Error display --

  it("shows the inline error when the mutation is in error state", () => {
    const errorText = "Slug already in use.";
    mockMutationError(api.orgs.create, createMutation, errorText);
    renderUI(<CreateOrgDialog {...buildProps()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  it("does NOT render an alert when there is no mutation error", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -- Cancel behavior --

  it("calls onClose when the Cancel button is clicked", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("resets the mutation state when Cancel is clicked", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(createMutation.reset).toHaveBeenCalledOnce();
  });

  it("does NOT call onCreated when Cancel is clicked", () => {
    renderUI(<CreateOrgDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnCreated).not.toHaveBeenCalled();
  });
});
