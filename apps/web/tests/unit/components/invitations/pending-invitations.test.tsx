import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/invitations/use-invitation-actions", () => ({
  useInvitationActions: vi.fn(() => ({
    accept: vi.fn(),
    decline: vi.fn(),
    isAccepting: false,
    isDeclining: false,
  })),
}));

import { api } from "@/lib/trpc/client";
import { useInvitationActions } from "@/components/invitations/use-invitation-actions";
import { PendingInvitations } from "@/components/invitations/pending-invitations";
import { makeMyInvitation } from "@/tests/support/factories";
import { mockUseQuery } from "@/tests/support/trpc";

describe("PendingInvitations", () => {
  it("renders the shared EmptyState when there are no pending invitations", () => {
    mockUseQuery(api.invitations.listMine, []);
    render(<PendingInvitations />);
    expect(screen.getByText("No pending invitations")).toBeInTheDocument();
  });

  it("renders null while the query hasn't resolved yet", () => {
    mockUseQuery(api.invitations.listMine, undefined);
    const { container } = render(<PendingInvitations />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the invitation count heading and each org's name/role", () => {
    mockUseQuery(api.invitations.listMine, [
      makeMyInvitation({ id: "inv-1", orgName: "Acme", role: "MEMBER" }),
      makeMyInvitation({ id: "inv-2", orgName: "Globex", role: "ADMIN" }),
    ]);
    render(<PendingInvitations />);
    expect(screen.getByText("Pending invitations (2)")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
  });

  it("renders each invitation's expiry date", () => {
    mockUseQuery(api.invitations.listMine, [
      makeMyInvitation({ id: "inv-1", expiresAt: new Date("2026-06-13") }),
    ]);
    render(<PendingInvitations />);
    expect(
      screen.getByText(`Expires ${new Date("2026-06-13").toLocaleDateString("en-US")}`),
    ).toBeInTheDocument();
  });

  it("calls accept with the invitation id", async () => {
    const accept = vi.fn();
    vi.mocked(useInvitationActions).mockReturnValue({
      accept,
      decline: vi.fn(),
      isAccepting: false,
      isDeclining: false,
    });
    mockUseQuery(api.invitations.listMine, [makeMyInvitation({ id: "inv-1" })]);
    render(<PendingInvitations />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Accept" }));
    expect(accept).toHaveBeenCalledWith({ invitationId: "inv-1" });
  });

  it("calls decline with the invitation id", async () => {
    const decline = vi.fn();
    vi.mocked(useInvitationActions).mockReturnValue({
      accept: vi.fn(),
      decline,
      isAccepting: false,
      isDeclining: false,
    });
    mockUseQuery(api.invitations.listMine, [makeMyInvitation({ id: "inv-1" })]);
    render(<PendingInvitations />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Decline" }));
    expect(decline).toHaveBeenCalledWith({ invitationId: "inv-1" });
  });

  it("disables the buttons while a mutation is pending", () => {
    vi.mocked(useInvitationActions).mockReturnValue({
      accept: vi.fn(),
      decline: vi.fn(),
      isAccepting: true,
      isDeclining: true,
    });
    mockUseQuery(api.invitations.listMine, [makeMyInvitation({ id: "inv-1" })]);
    render(<PendingInvitations />);

    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
  });
});
