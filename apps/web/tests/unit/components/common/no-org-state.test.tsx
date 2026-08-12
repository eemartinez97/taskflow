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
vi.mock("@/components/invitations/use-invitation-actions", () => ({
  useInvitationActions: vi.fn(() => ({
    accept: vi.fn(),
    decline: vi.fn(),
    isAccepting: false,
    isDeclining: false,
  })),
}));

import { api } from "@/lib/trpc/client";
import { NoOrgState } from "@/components/common/no-org-state";
import { makeMyInvitation } from "@/tests/support/factories";
import { mockUseQuery } from "@/tests/support/trpc";
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

  it("defaults to the 'ask your team owner' copy with no pending invitations", () => {
    setupRouterMock();
    mockUseQuery(api.invitations.listMine, []);
    render(<NoOrgState />);
    expect(screen.getByText(/ask your team owner to invite you/i)).toBeInTheDocument();
  });

  it("switches to the accept-invitation copy and shows PendingInvitations when one exists", () => {
    setupRouterMock();
    mockUseQuery(api.invitations.listMine, [makeMyInvitation({ orgName: "Acme" })]);
    render(<NoOrgState />);
    expect(screen.getByText(/accept one of your pending invitations below/i)).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });
});
