import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/components/common/no-org-state", () => ({
  NoOrgState: ({ context }: { context: string }) => <p>NoOrgState: {context}</p>,
}));
vi.mock("@/app/(dashboard)/team/_components/team-client", () => ({
  TeamClient: ({
    currentUserId,
    currentUserRole,
  }: {
    currentUserId: string;
    currentUserRole: string;
  }) => (
    <p>
      TeamClient: {currentUserId} / {currentUserRole}
    </p>
  ),
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getSession } from "@/lib/auth/session";
import TeamPage from "@/app/(dashboard)/team/page";
import { mockAuthorizedUser } from "@/tests/support/fixtures";
import { makeOrg } from "@/tests/support/factories";
import { mockGetServerTRPC } from "@/tests/support/trpc";

describe("TeamPage (Server Component)", () => {
  it("renders NoOrgState when there is no organization", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);
    render(await TeamPage());
    expect(screen.getByText(/NoOrgState/)).toBeInTheDocument();
  });

  it("passes the current session user id and role down to TeamClient", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);
    render(await TeamPage());
    expect(screen.getByText(`TeamClient: ${mockAuthorizedUser.id} / OWNER`)).toBeInTheDocument();
  });

  it("falls back to an empty user id when the session is null", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    vi.mocked(getSession).mockResolvedValue(null);
    render(await TeamPage());
    expect(screen.getByText(/TeamClient: \/ OWNER/)).toBeInTheDocument();
  });

  it("falls back to VIEWER role when the org has no memberships", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ memberships: [] }));
    vi.mocked(getSession).mockResolvedValue(mockAuthorizedUser);
    render(await TeamPage());
    expect(screen.getByText(`TeamClient: ${mockAuthorizedUser.id} / VIEWER`)).toBeInTheDocument();
  });
});
