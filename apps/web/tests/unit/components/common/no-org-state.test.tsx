import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/organizations/create-org-dialog", () => ({
  CreateOrgDialog: ({ open, onCreated }: { open: boolean; onCreated: (id: string) => void }) =>
    open ? (
      <button
        onClick={() => {
          onCreated("brand-new-org");
        }}
      >
        Create
      </button>
    ) : null,
}));

import { NoOrgState } from "@/components/common/no-org-state";
import { setupRouterMock } from "@/tests/support/render";

describe("NoOrgState", () => {
  it("renders the base heading without context", () => {
    setupRouterMock();
    render(<NoOrgState />);
    expect(screen.getByText(/not part of any organization/i)).toBeInTheDocument();
  });

  it("renders the optional context message when provided", () => {
    setupRouterMock();
    render(<NoOrgState context="Custom context message" />);
    expect(screen.getByText("Custom context message")).toBeInTheDocument();
  });

  it("opens the create-org dialog when 'create one' is clicked", async () => {
    setupRouterMock();
    render(<NoOrgState />);
    await userEvent.setup().click(screen.getByRole("button", { name: /create one/i }));
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
  });

  it("refreshes the router once a new org is created", async () => {
    const { refreshMock } = setupRouterMock();
    render(<NoOrgState />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create one/i }));
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(refreshMock).toHaveBeenCalled();
  });
});
