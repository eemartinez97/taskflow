import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-org-invitations-realtime", () => ({
  useOrgInvitationsRealtime: vi.fn(),
}));
vi.mock("@/app/(dashboard)/organizations/[orgId]/_components/members-section", () => ({
  MembersSection: ({ orgId }: { orgId: string }) => <p>MembersSection: {orgId}</p>,
}));
vi.mock("@/app/(dashboard)/organizations/[orgId]/_components/invitations-section", () => ({
  InvitationsSection: ({ orgId }: { orgId: string }) => <p>InvitationsSection: {orgId}</p>,
}));
vi.mock("@/app/(dashboard)/organizations/[orgId]/_components/invite-dialog", () => ({
  InviteDialog: ({ open }: { open: boolean }) => (open ? <p>InviteDialog open</p> : null),
}));

import { useOrgInvitationsRealtime } from "@/lib/hooks/use-org-invitations-realtime";
import { OrgDetailClient } from "@/app/(dashboard)/organizations/[orgId]/_components/org-detail-client";

function buildProps(overrides: Partial<Parameters<typeof OrgDetailClient>[0]> = {}) {
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

describe("OrgDetailClient", () => {
  it("renders the org name and role badge", () => {
    render(<OrgDetailClient {...buildProps()} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("OWNER")).toBeInTheDocument();
  });

  it("subscribes to org invitation realtime updates", () => {
    render(<OrgDetailClient {...buildProps()} />);
    expect(useOrgInvitationsRealtime).toHaveBeenCalledWith("org-1");
  });

  it("shows the invite button and invitations section for an admin", () => {
    render(<OrgDetailClient {...buildProps({ currentUserRole: "ADMIN" })} />);
    expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument();
    expect(screen.getByText("InvitationsSection: org-1")).toBeInTheDocument();
  });

  it("hides the invite button and invitations section for a non-admin", () => {
    render(<OrgDetailClient {...buildProps({ currentUserRole: "MEMBER" })} />);
    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
    expect(screen.queryByText("InvitationsSection: org-1")).not.toBeInTheDocument();
  });

  it("opens the invite dialog when the invite button is clicked", async () => {
    render(<OrgDetailClient {...buildProps({ currentUserRole: "ADMIN" })} />);
    expect(screen.queryByText("InviteDialog open")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /invite member/i }));
    expect(screen.getByText("InviteDialog open")).toBeInTheDocument();
  });

  it("always renders the members section", () => {
    render(<OrgDetailClient {...buildProps()} />);
    expect(screen.getByText("MembersSection: org-1")).toBeInTheDocument();
  });
});
