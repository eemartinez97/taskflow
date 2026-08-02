import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { InviteDialog } from "@/app/(dashboard)/team/_components/invite-dialog";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation, mockMutationError } from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";

// -- Helpers --
const mockOnClose = vi.fn();
let mockInvalidateMembers: ReturnType<typeof vi.fn>;
let inviteMutation: ReturnType<typeof wireCapturableMutation>;

function buildProps(overrides: { open?: boolean } = {}) {
  return {
    orgId: "org-1",
    open: true,
    onClose: mockOnClose,
    ...overrides,
  };
}

// -- Tests --
describe("InviteDialog", () => {
  beforeEach(() => {
    mockInvalidateMembers = vi.fn();
    mockApiUtils({ orgs: { members: { invalidate: mockInvalidateMembers } } });
    inviteMutation = wireCapturableMutation(api.orgs.invite);
  });

  // -- Rendering --

  it("does not render when open is false", () => {
    renderUI(<InviteDialog {...buildProps({ open: false })} />);

    expect(screen.queryByText("Invite member")).not.toBeInTheDocument();
  });

  it("renders the dialog title when open is true", () => {
    renderUI(<InviteDialog {...buildProps()} />);

    expect(screen.getByText("Invite member")).toBeInTheDocument();
  });

  it("renders an empty Email field", () => {
    renderUI(<InviteDialog {...buildProps()} />);

    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  it("renders a Role select defaulting to MEMBER", () => {
    renderUI(<InviteDialog {...buildProps()} />);

    expect(screen.getByLabelText("Role")).toHaveValue("MEMBER");
  });

  it("renders role options excluding OWNER", () => {
    renderUI(<InviteDialog {...buildProps()} />);

    expect(screen.queryByRole("option", { name: "OWNER" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ADMIN" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "MEMBER" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "VIEWER" })).toBeInTheDocument();
  });

  it("renders 'Send invite' and 'Close' footer buttons", () => {
    renderUI(<InviteDialog {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Send invite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  // -- Client-side validation --

  it("shows a validation error and does NOT call mutate when email is empty", async () => {
    renderUI(<InviteDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(inviteMutation.mutate).not.toHaveBeenCalled();
  });

  it("shows a validation error for an invalid email format", async () => {
    renderUI(<InviteDialog {...buildProps()} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(inviteMutation.mutate).not.toHaveBeenCalled();
  });

  // -- Form submission --

  it("calls invitation mutation with the email and selected role on submit", async () => {
    renderUI(<InviteDialog {...buildProps()} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newmember@taskflow.dev" },
    });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "ADMIN" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() => {
      expect(inviteMutation.mutate).toHaveBeenCalledWith({
        orgId: "org-1",
        data: { email: "newmember@taskflow.dev", role: "ADMIN" },
      });
    });
  });

  // -- Success side effects --

  it("shows an 'Invitation sent.' toast on mutation success", () => {
    renderUI(<InviteDialog {...buildProps()} />);

    act(() => {
      inviteMutation.simulateSuccess();
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Invitation sent.");
  });

  it("invalidates orgs.members on mutation success", () => {
    renderUI(<InviteDialog {...buildProps()} />);

    act(() => {
      inviteMutation.simulateSuccess();
    });

    expect(mockInvalidateMembers).toHaveBeenCalledWith({ orgId: "org-1" });
  });

  it("calls onClose on mutation success", () => {
    renderUI(<InviteDialog {...buildProps()} />);

    act(() => {
      inviteMutation.simulateSuccess();
    });

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  // -- Error display --

  it("shows the inline error when the mutation is in error state", () => {
    const errorText = "User not found. They must register first.";
    mockMutationError(api.orgs.invite, inviteMutation, errorText);
    renderUI(<InviteDialog {...buildProps()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  // -- Cancel behavior --

  it("calls onClose when the Close button is clicked", () => {
    renderUI(<InviteDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("resets the mutation state when Close is clicked", () => {
    renderUI(<InviteDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(inviteMutation.reset).toHaveBeenCalledOnce();
  });
});
