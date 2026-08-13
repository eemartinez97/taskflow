import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/invitations/pending-invitations", () => ({
  PendingInvitations: () => <p>PendingInvitations</p>,
}));

import InvitationsPage from "@/app/(dashboard)/invitations/page";

describe("InvitationsPage", () => {
  it("renders the heading and the pending invitations list", () => {
    render(<InvitationsPage />);
    expect(screen.getByRole("heading", { name: "Invitations" })).toBeInTheDocument();
    expect(screen.getByText("PendingInvitations")).toBeInTheDocument();
  });
});
