import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Toast, ToastContainer } from "../src";
import type { ToastItem } from "../src";

// Timer behavior tests (fake timers required)

describe("Toast - timer behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onDismiss after the default duration (4000ms)", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Auto dismiss" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onDismiss after a custom duration", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Fast" duration={1500} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not auto-dismiss when duration is 0", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Sticky" duration={0} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(99999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("clears the timer on unmount to avoid memory leaks", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast message="Will unmount" onDismiss={onDismiss} />);
    unmount();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // onDismiss must NOT be called after unmount
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("pauses auto-dismiss while the pointer is hovering the toast", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Hover pause" duration={1500} onDismiss={onDismiss} />);
    fireEvent.mouseEnter(screen.getByRole("alert"));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses 3s after the pointer leaves a hovered toast, not the original duration", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Hover then leave" duration={1500} onDismiss={onDismiss} />);
    const alert = screen.getByRole("alert");

    fireEvent.mouseEnter(alert);
    act(() => {
      // Past the original 1500ms duration - proves it's not just resuming
      // the original timer once un-hovered.
      vi.advanceTimersByTime(1500);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.mouseLeave(alert);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("ignores hover on a sticky (duration=0) toast - it still never auto-dismisses", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Sticky hover" duration={0} onDismiss={onDismiss} />);
    const alert = screen.getByRole("alert");

    fireEvent.mouseEnter(alert);
    fireEvent.mouseLeave(alert);
    act(() => {
      vi.advanceTimersByTime(99_999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

// Rendering and interaction tests (real timers - no timer logic involved)

describe("Toast - rendering and interactions", () => {
  it("renders the message", () => {
    render(<Toast message="Operation successful" onDismiss={vi.fn()} />);
    expect(screen.getByText("Operation successful")).toBeInTheDocument();
  });

  it("has role=alert for screen readers", () => {
    render(<Toast message="Hello" onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    // duration=0 disables the internal setTimeout entirely - no fake timers needed
    render(<Toast message="Click to dismiss" duration={0} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("applies correct styles for each variant", () => {
    const variants = ["success", "error", "warning", "info"] as const;
    const expectedClasses: Record<(typeof variants)[number], string> = {
      success: "bg-green-50",
      error: "bg-red-50",
      warning: "bg-yellow-50",
      info: "bg-blue-50",
    };

    for (const variant of variants) {
      const { unmount } = render(
        <Toast message={variant} variant={variant} duration={0} onDismiss={vi.fn()} />,
      );
      expect(screen.getByRole("alert")).toHaveClass(expectedClasses[variant]);
      unmount();
    }
  });

  it("uses inline animation style (no tailwindcss-animate dependency)", () => {
    render(<Toast message="Animated" duration={0} onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveStyle({ animation: "tf-slide-in 0.2s ease-out" });
  });
});

// ToastContainer

describe("ToastContainer", () => {
  const toasts: ToastItem[] = [
    { id: "1", message: "First toast", variant: "success" },
    { id: "2", message: "Second toast", variant: "error" },
  ];

  it("renders all toasts", () => {
    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);
    expect(screen.getByText("First toast")).toBeInTheDocument();
    expect(screen.getByText("Second toast")).toBeInTheDocument();
  });

  it("renders nothing when toasts array is empty", () => {
    render(<ToastContainer toasts={[]} onDismiss={vi.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls onDismiss with the correct toast id", async () => {
    const onDismiss = vi.fn();
    // duration=0 disables auto-dismiss - no fake timers needed
    const staticToasts: ToastItem[] = [
      { id: "1", message: "First", duration: 0 },
      { id: "2", message: "Second", duration: 0 },
    ];
    render(<ToastContainer toasts={staticToasts} onDismiss={onDismiss} />);

    const dismissButtons = screen.getAllByRole("button", { name: "Dismiss notification" });
    const secondButton = dismissButtons.at(1);
    if (!secondButton) throw new Error("Expected second dismiss button to exist");

    await userEvent.click(secondButton);
    expect(onDismiss).toHaveBeenCalledWith("2");
  });
});
