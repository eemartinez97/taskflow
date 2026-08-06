import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { signOut } from "next-auth/react";
import { api } from "@/lib/trpc/client";
import DashboardError from "@/app/(dashboard)/error";
import { setupMutationMockWithMutateCallbacks } from "@/tests/support/trpc";

describe("DashboardError", () => {
  it("shows the fallback message", () => {
    render(<DashboardError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
  });

  it("shows the digest as a correlation reference when present", () => {
    const error = Object.assign(new Error("boom"), { digest: "123456789" });
    render(<DashboardError error={error} reset={vi.fn()} />);
    expect(screen.getByText(/reference: 123456789/i)).toBeInTheDocument();
  });

  it("does not render a reference line when there is no digest", () => {
    render(<DashboardError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.queryByText(/reference:/i)).not.toBeInTheDocument();
  });

  it("calls reset() on 'Try again' click", async () => {
    const reset = vi.fn();
    render(<DashboardError error={new Error("boom")} reset={reset} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("invalidates sessions server-side then signs out client-side on 'Sign in again' click", async () => {
    const { mutateMock } = setupMutationMockWithMutateCallbacks(api.auth.signOut);
    render(<DashboardError error={new Error("boom")} reset={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /sign in again/i }));
    expect(mutateMock).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
