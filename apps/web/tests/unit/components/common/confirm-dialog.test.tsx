import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/common/confirm-dialog";

describe("ConfirmDialog", () => {
  it("does not render when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="T"
        description="D"
      />,
    );
    expect(screen.queryByText("T")).not.toBeInTheDocument();
  });

  it("calls onConfirm directly when no confirmText guard is set", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open onClose={vi.fn()} onConfirm={onConfirm} title="T" description="D" />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("disables confirm until the typed text matches confirmText exactly", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Delete project"
        description="D"
        confirmText="my-project"
      />,
    );
    const confirmButton = screen.getByRole("button", { name: /^confirm$/i });
    expect(confirmButton).toBeDisabled();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/type/i), "wrong-text");
    expect(confirmButton).toBeDisabled();
    await user.clear(screen.getByLabelText(/type/i));
    await user.type(screen.getByLabelText(/type/i), "my-project");
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("resets the typed guard text and calls onClose on Cancel", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={vi.fn()}
        title="T"
        description="D"
        confirmText="x"
      />,
    );
    await userEvent.setup().type(screen.getByLabelText(/type/i), "partial");
    await userEvent.setup().click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables both buttons while loading", () => {
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="T"
        description="D"
        loading
      />,
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });
});
