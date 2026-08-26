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
    staleOrgLink,
  }: {
    orgId: string;
    orgName: string;
    currentUserId: string;
    currentUserRole: string;
    initialMembers: unknown[];
    initialInvitations: unknown[];
    staleOrgLink: boolean;
  }) => (
    <p>
      TeamClient: {orgId} / {orgName} / {currentUserId} / {currentUserRole} /{" "}
      {initialMembers.length} members / {initialInvitations.length} invitations / staleOrgLink=
      {String(staleOrgLink)}
    </p>
  ),
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getSession } from "@/lib/auth/session";
import TeamPage, { generateMetadata } from "@/app/(dashboard)/team/page";
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

    render(await TeamPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/NoOrgState/)).toBeInTheDocument();
  });

  it("only fetches invitations.listForOrg for an admin/owner", async () => {
    const listForOrg = vi.fn().mockResolvedValue([makeOrgInvitation()]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { listForOrg } });
    vi.mocked(getOrgOrNull).mockResolvedValue(
      makeOrg({ id: "org-1", name: "Acme", role: "OWNER" }),
    );
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await TeamPage({ searchParams: Promise.resolve({}) }));

    expect(listForOrg).toHaveBeenCalledWith({ orgId: "org-1" });
    expect(
      screen.getByText(
        `TeamClient: org-1 / Acme / ${mockAuthorizedUser.id} / OWNER / 0 members / 1 invitations / staleOrgLink=false`,
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

    render(await TeamPage({ searchParams: Promise.resolve({}) }));

    expect(listForOrg).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        `TeamClient: org-1 / Acme / ${mockAuthorizedUser.id} / MEMBER / 0 members / 0 invitations / staleOrgLink=false`,
      ),
    ).toBeInTheDocument();
  });

  it("falls back to an empty user id when the session is null", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    vi.mocked(getSession).mockResolvedValue(null);

    render(await TeamPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/TeamClient: .* \/ \/ OWNER/)).toBeInTheDocument();
  });

  it("falls back to VIEWER role when the org has no memberships", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ memberships: [] }));
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await TeamPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/VIEWER/)).toBeInTheDocument();
  });

  it("flags a stale deep link when ?from doesn't match the resolved org", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ id: "org-1" }));
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await TeamPage({ searchParams: Promise.resolve({ from: "org-2" }) }));

    expect(screen.getByText(/staleOrgLink=true/)).toBeInTheDocument();
  });

  it("does not flag a fresh deep link where ?from matches the resolved org", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ id: "org-1" }));
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await TeamPage({ searchParams: Promise.resolve({ from: "org-1" }) }));

    expect(screen.getByText(/staleOrgLink=false/)).toBeInTheDocument();
  });
});

describe("generateMetadata", () => {
  it("titles the tab with the org name so multiple orgs are distinguishable", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ name: "Acme" }));

    await expect(generateMetadata()).resolves.toEqual({ title: "Acme · Team" });
  });

  it("falls back to a plain 'Team' title when there is no org", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);

    await expect(generateMetadata()).resolves.toEqual({ title: "Team" });
  });
});
