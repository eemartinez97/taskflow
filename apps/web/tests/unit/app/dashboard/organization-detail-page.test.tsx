import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgByIdOrNotFound: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

vi.mock("@/app/(dashboard)/organizations/[orgId]/_components/org-detail-client", () => ({
  OrgDetailClient: ({
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
      OrgDetailClient: {orgId} / {orgName} / {currentUserId} / {currentUserRole} /{" "}
      {initialMembers.length} members / {initialInvitations.length} invitations
    </p>
  ),
}));

import { notFound } from "next/navigation";
import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgByIdOrNotFound } from "@/lib/utils/org-utils";
import { getSession } from "@/lib/auth/session";
import OrganizationDetailPage, {
  generateMetadata,
} from "@/app/(dashboard)/organizations/[orgId]/page";
import { mockAuthorizedUser } from "@/tests/support/fixtures";
import { makeOrg, makeOrgInvitation } from "@/tests/support/factories";
import { mockGetServerTRPC } from "@/tests/support/trpc";

function params(orgId = "org-1"): Promise<{ orgId: string }> {
  return Promise.resolve({ orgId });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateMetadata", () => {
  it("returns the org's name as title", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgByIdOrNotFound).mockResolvedValue(makeOrg({ name: "Acme Corp" }));

    const meta = await generateMetadata({ params: params() });
    expect(meta.title).toBe("Acme Corp");
  });

  it("falls back to 'Organization' when resolution throws (e.g. notFound)", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgByIdOrNotFound).mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    const meta = await generateMetadata({ params: params() });
    expect(meta.title).toBe("Organization");
  });
});

describe("OrganizationDetailPage", () => {
  it("propagates notFound() when the org doesn't belong to the caller", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgByIdOrNotFound).mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    vi.mocked(notFound).mockImplementationOnce(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(OrganizationDetailPage({ params: params() })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("only fetches invitations.listForOrg for an admin/owner", async () => {
    const listForOrg = vi.fn().mockResolvedValue([makeOrgInvitation()]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { listForOrg } });
    vi.mocked(getOrgByIdOrNotFound).mockResolvedValue(
      makeOrg({ id: "org-1", name: "Acme", role: "OWNER" }),
    );
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await OrganizationDetailPage({ params: params("org-1") }));

    expect(listForOrg).toHaveBeenCalledWith({ orgId: "org-1" });
    expect(
      screen.getByText(
        `OrgDetailClient: org-1 / Acme / ${mockAuthorizedUser.id} / OWNER / 0 members / 1 invitations`,
      ),
    ).toBeInTheDocument();
  });

  it("skips invitations.listForOrg for a non-admin viewer", async () => {
    const listForOrg = vi.fn().mockResolvedValue([makeOrgInvitation()]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { listForOrg } });
    vi.mocked(getOrgByIdOrNotFound).mockResolvedValue(
      makeOrg({ id: "org-1", name: "Acme", role: "MEMBER" }),
    );
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await OrganizationDetailPage({ params: params("org-1") }));

    expect(listForOrg).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        `OrgDetailClient: org-1 / Acme / ${mockAuthorizedUser.id} / MEMBER / 0 members / 0 invitations`,
      ),
    ).toBeInTheDocument();
  });

  it("falls back to an empty user id when the session is null", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgByIdOrNotFound).mockResolvedValue(makeOrg());
    vi.mocked(getSession).mockResolvedValue(null);

    render(await OrganizationDetailPage({ params: params() }));

    expect(screen.getByText(/OrgDetailClient: .* \/ \/ OWNER/)).toBeInTheDocument();
  });

  it("falls back to VIEWER role when the org has no memberships", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgByIdOrNotFound).mockResolvedValue(makeOrg({ memberships: [] }));
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);

    render(await OrganizationDetailPage({ params: params() }));

    expect(screen.getByText(/VIEWER/)).toBeInTheDocument();
  });
});
