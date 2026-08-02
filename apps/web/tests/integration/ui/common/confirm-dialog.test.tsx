import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { renderUI } from "../../helpers/render";

// -- Shared fixtures --

const TITLE = "Delete organization";
const DESCRIPTION = "This action cannot be undone.";

function buildProps(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: TITLE,
    description: DESCRIPTION,
    ...overrides,
  };
}

// -- Tests --

describe("ConfirmDialog", () => {
  // -- Rendering --

  it("renders the title", () => {
    renderUI(<ConfirmDialog {...buildProps()} />);

    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  it("renders the description", () => {
    renderUI(<ConfirmDialog {...buildProps()} />);

    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();
  });

  it('renders "Confirm" as the default confirm label', () => {
    renderUI(<ConfirmDialog {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("renders a custom confirmLabel when provided", () => {
    renderUI(<ConfirmDialog {...buildProps({ confirmLabel: "Yes, delete everything" })} />);

    expect(screen.getByRole("button", { name: "Yes, delete everything" })).toBeInTheDocument();
  });

  it("renders nothing when open is false", () => {
    renderUI(<ConfirmDialog {...buildProps({ open: false })} />);

    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  // -- Without confirmText guard --

  it("confirm button is enabled when there is no confirmText guard", () => {
    renderUI(<ConfirmDialog {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const props = buildProps();
    renderUI(<ConfirmDialog {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onClose when the cancel button is clicked", () => {
    const props = buildProps();
    renderUI(<ConfirmDialog {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onClose).toHaveBeenCalledOnce();
  });

  // -- With confirmText guard --

  describe("with confirmText guard", () => {
    const CONFIRM_TEXT = "my-org-slug";

    it("renders the confirmation input field", () => {
      renderUI(<ConfirmDialog {...buildProps({ confirmText: CONFIRM_TEXT })} />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("disables the confirm button when the input is empty", () => {
      renderUI(<ConfirmDialog {...buildProps({ confirmText: CONFIRM_TEXT })} />);

      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    });

    it("keeps the confirm button disabled when the typed text does not match", () => {
      renderUI(<ConfirmDialog {...buildProps({ confirmText: CONFIRM_TEXT })} />);
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "wrong-text" } });

      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    });

    it("enables the confirm button when the typed text matches exactly", async () => {
      renderUI(<ConfirmDialog {...buildProps({ confirmText: CONFIRM_TEXT })} />);
      fireEvent.change(screen.getByRole("textbox"), { target: { value: CONFIRM_TEXT } });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
      });
    });

    it("calls onConfirm once the text matches and the confirm button is clicked", async () => {
      const props = buildProps({ confirmText: CONFIRM_TEXT });
      renderUI(<ConfirmDialog {...props} />);

      fireEvent.change(screen.getByRole("textbox"), { target: { value: CONFIRM_TEXT } });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
      });
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

      expect(props.onConfirm).toHaveBeenCalledOnce();
    });

    it("resets the typed input and calls onClose when cancel is clicked", () => {
      const props = buildProps({ confirmText: CONFIRM_TEXT });
      renderUI(<ConfirmDialog {...props} />);

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "some-text" } });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(props.onClose).toHaveBeenCalledOnce();
      // Input is reset to "" by handleClose's internal setTyped("")
      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });

  // -- Loading state --

  describe("loading state", () => {
    it("disables the Cancel button when loading is true", () => {
      renderUI(<ConfirmDialog {...buildProps({ loading: true })} />);

      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    });

    it("disables the Confirm button when loading is true", () => {
      renderUI(<ConfirmDialog {...buildProps({ loading: true })} />);

      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    });

    it("does not call onConfirm when the loading Confirm button is focused and Enter is pressed", () => {
      const props = buildProps({ loading: true });
      renderUI(<ConfirmDialog {...props} />);

      const confirmBtn = screen.getByRole("button", { name: "Confirm" });
      fireEvent.keyDown(confirmBtn, { key: "Enter" });

      expect(props.onConfirm).not.toHaveBeenCalled();
    });
  });
});
