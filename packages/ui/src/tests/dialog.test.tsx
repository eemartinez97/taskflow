import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { Dialog } from "../dialog";

/**
 * jsdom does not implement HTMLDialogElement.showModal() / close().
 * We mock them at the prototype level so useEffect calls don't throw.
 * The mock also syncs the `open` attribute so our class-based assertions work.
 */
function mockDialogMethods(): void {
  HTMLDialogElement.prototype.showModal = function (): void {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (): void {
    this.removeAttribute("open");
    // Dispatch the native `close` event so the dialog's useEffect listener fires
    this.dispatchEvent(new Event("close"));
  };
}

describe("Dialog", () => {
  beforeAll(() => {
    mockDialogMethods();
  });

  it("renders title and children when open", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Confirm action">
        <p>Are you sure?</p>
      </Dialog>,
    );
    expect(screen.getByRole("heading", { name: "Confirm action" })).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("renders optional description when provided", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Title" description="This cannot be undone.">
        <span>Child</span>
      </Dialog>,
    );
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Title">
        <span>Child</span>
      </Dialog>,
    );
    // No paragraph with description text in the header area
    expect(screen.queryByText("This cannot be undone.")).not.toBeInTheDocument();
  });

  it("applies flex classes when open=true (Fix #10 — no open: Tailwind variant)", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Open dialog">
        <span>Content</span>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("flex");
    expect(dialog).toHaveClass("flex-col");
    expect(dialog).not.toHaveClass("hidden");
  });

  it("applies hidden class when open=false", () => {
    render(
      <Dialog open={false} onClose={vi.fn()} title="Closed dialog">
        <span>Content</span>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveClass("hidden");
    expect(dialog).not.toHaveClass("flex");
  });

  it("uses correct backdrop class (Fix #10 — bg-black/40, not bg-black.40)", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Backdrop test">
        <span />
      </Dialog>,
    );
    // Verify the class string contains the correct slash syntax
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("backdrop:bg-black/40");
    expect(dialog.className).not.toContain("backdrop:bg-black.40");
  });

  it("calls onClose when Escape triggers the native close event", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Escape test">
        <span />
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    // Simulate the browser dispatching `close` (e.g. on Escape key)
    act(() => {
      dialog.dispatchEvent(new Event("close"));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking the backdrop (the dialog element itself)", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Backdrop click">
        <span>Inner</span>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    // Simulate a click directly on the <dialog> element (not a child)
    await userEvent.click(dialog, { pointerEventsCheck: 0 });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when clicking content inside the dialog", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Inner click">
        <button>Inner button</button>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Inner button" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes the close event listener on unmount to avoid memory leaks", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Dialog open onClose={onClose} title="Cleanup test">
        <span />
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    unmount();
    // After unmount, firing close should not call onClose
    act(() => {
      dialog.dispatchEvent(new Event("close"));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("merges custom className", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Custom class" className="max-w-lg">
        <span />
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("max-w-lg");
  });

  it("calls el.close() when open transitions from true to false", () => {
    const closeSpy = vi.spyOn(HTMLDialogElement.prototype, "close");

    const { rerender } = render(
      <Dialog open onClose={vi.fn()} title="Transition test">
        <span />
      </Dialog>,
    );

    // Transition open -> closed: triggers the else id (!open && el.open) branch
    rerender(
      <Dialog open={false} onClose={vi.fn()} title="Transition test">
        <span />
      </Dialog>,
    );

    expect(closeSpy).toHaveBeenCalled();
    closeSpy.mockRestore();
  });
});
