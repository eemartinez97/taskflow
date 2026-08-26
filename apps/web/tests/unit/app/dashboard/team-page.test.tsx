import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/components/common/no-org-state", () => ({
  NoOrgState: ({ context }: { context: string }) => <p>NoOrgState: {context}</p>,
}));

vi.mock("@/app/(dashboard)/team/_components/team-client", () => ({
  TeamClient: ({
    orgId,
    orgName,
    currentUserId,
    currentUserRole,
    initialMembers,
    initialInvitations,
  }: {
    orgId: string;
    orgName: string;
    currentUserId: string;
    currentUserRole: string;
    initialMembers: unknown[];
    initialInvitations: unknown[];
  }) => (
    <p>
      TeamClient: {orgId} / {orgName} / {currentUserId} / {currentUserRole} /{" "}
      {initialMembers.length} members / {initialInvitations.length} invitations
    </p>
  ),
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getSession } from "@/lib/auth/session";
import TeamPage from "@/app/(dashboard)/team/page";
import { mockAuthorizedUser } from "@/tests/support/fixtures";
import { makeOrg, makeOrgInvitation } from "@/tests/support/factories";
import { mockGetServerTRPC } from "@/tests/support/trpc";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TeamPage (Server Component)", () => {
  it("renders NoOrgState when there is no organization", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);

    render(await TeamPage());

    expect(screen.getByText(/NoOrgState/)).toBeInTheDocument();
  });

  it("only fetches invitations.listForOrg for an admin/owner", async () => {
    const listForOrg = vi.fn().mockResolvedValue([makeOrgInvitation()]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { listForOrg } });
    vi.mocked(getOrgOrNull).mockResolvedValue(
      makeOrg({ id: "org-1", name: "Acme", role: "OWNER" }),
    );
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await TeamPage());

    expect(listForOrg).toHaveBeenCalledWith({ orgId: "org-1" });
    expect(
      screen.getByText(
        `TeamClient: org-1 / Acme / ${mockAuthorizedUser.id} / OWNER / 0 members / 1 invitations`,
      ),
    ).toBeInTheDocument();
  });

  it("skips invitations.listForOrg for a non-admin viewer", async () => {
    const listForOrg = vi.fn().mockResolvedValue([makeOrgInvitation()]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { listForOrg } });
    vi.mocked(getOrgOrNull).mockResolvedValue(
      makeOrg({ id: "org-1", name: "Acme", role: "MEMBER" }),
    );
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await TeamPage());

    expect(listForOrg).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        `TeamClient: org-1 / Acme / ${mockAuthorizedUser.id} / MEMBER / 0 members / 0 invitations`,
      ),
    ).toBeInTheDocument();
  });

  it("falls back to an empty user id when the session is null", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    vi.mocked(getSession).mockResolvedValue(null);

    render(await TeamPage());

    expect(screen.getByText(/TeamClient: .* \/ \/ OWNER/)).toBeInTheDocument();
  });

  it("falls back to VIEWER role when the org has no memberships", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ memberships: [] }));
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await TeamPage());

    expect(screen.getByText(/VIEWER/)).toBeInTheDocument();
  });
});
