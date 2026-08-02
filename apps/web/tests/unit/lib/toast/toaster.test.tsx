import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/lib/toast/toaster";
import { dismissToast, getToasts, toast } from "@/lib/toast/store";

vi.unmock("@/lib/toast/store");

afterEach(() => {
  act(() => {
    for (const t of getToasts()) dismissToast(t.id);
  });
});

describe("Toaster", () => {
  it("renders nothing when the toast queue is empty", () => {
    render(<Toaster />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders a toast pushed to the store", () => {
    render(<Toaster />);

    act(() => {
      toast.success("Hello from the store");
    });

    expect(screen.getByText("Hello from the store")).toBeInTheDocument();
  });

  it("dismisses a toast when its dismiss control is used", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    toast.success("Dismiss me");
    render(<Toaster />);
    await userEvent.setup().click(screen.getByLabelText(/dismiss notification/i));
    expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
  });
});
