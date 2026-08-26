import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-org-invitations-realtime", () => ({
  useOrgInvitationsRealtime: vi.fn(),
}));
vi.mock("@/app/(dashboard)/team/_components/members-section", () => ({
  MembersSection: ({ orgId, onInviteClick }: { orgId: string; onInviteClick: () => void }) => (
    <div>
      <p>MembersSection: {orgId}</p>
      <button onClick={onInviteClick}>Empty-state invite trigger</button>
    </div>
  ),
}));
vi.mock("@/app/(dashboard)/team/_components/invitations-section", () => ({
  InvitationsSection: ({ orgId }: { orgId: string }) => <p>InvitationsSection: {orgId}</p>,
}));
vi.mock("@/app/(dashboard)/team/_components/invite-dialog", () => ({
  InviteDialog: ({ open }: { open: boolean }) => (open ? <p>InviteDialog open</p> : null),
}));

import { useOrgInvitationsRealtime } from "@/lib/hooks/use-org-invitations-realtime";
import { TeamClient } from "@/app/(dashboard)/team/_components/team-client";

function buildProps(overrides: Partial<Parameters<typeof TeamClient>[0]> = {}) {
  return {
    orgId: "org-1",
    orgName: "Acme",
    currentUserId: "user-1",
    currentUserRole: "OWNER" as const,
    initialMembers: [],
    initialInvitations: [],
    ...overrides,
  };
}

describe("TeamClient", () => {
  it("renders the org name and role badge", () => {
    render(<TeamClient {...buildProps()} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("OWNER")).toBeInTheDocument();
  });

  it("subscribes to org invitation realtime updates", () => {
    render(<TeamClient {...buildProps()} />);
    expect(useOrgInvitationsRealtime).toHaveBeenCalledWith("org-1");
  });

  it("shows the invite button and invitations section for an admin", () => {
    render(<TeamClient {...buildProps({ currentUserRole: "ADMIN" })} />);
    expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument();
    expect(screen.getByText("InvitationsSection: org-1")).toBeInTheDocument();
  });

  it("hides the invite button and invitations section for a non-admin", () => {
    render(<TeamClient {...buildProps({ currentUserRole: "MEMBER" })} />);
    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
    expect(screen.queryByText("InvitationsSection: org-1")).not.toBeInTheDocument();
  });

  it("opens the invite dialog when the invite button is clicked", async () => {
    render(<TeamClient {...buildProps({ currentUserRole: "ADMIN" })} />);
    expect(screen.queryByText("InviteDialog open")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /invite member/i }));
    expect(screen.getByText("InviteDialog open")).toBeInTheDocument();
  });

  it("always renders the members section", () => {
    render(<TeamClient {...buildProps()} />);
    expect(screen.getByText("MembersSection: org-1")).toBeInTheDocument();
  });

  it("wires MembersSection's onInviteClick to the same invite dialog", async () => {
    render(<TeamClient {...buildProps({ currentUserRole: "ADMIN" })} />);
    expect(screen.queryByText("InviteDialog open")).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /empty-state invite trigger/i }));
    expect(screen.getByText("InviteDialog open")).toBeInTheDocument();
  });
});
