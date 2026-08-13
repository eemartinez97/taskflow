import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));
vi.mock("@/app/(dashboard)/settings/_components/label-manager", () => ({
  LabelManager: ({ orgId }: { orgId: string }) => <p>LabelManager: {orgId}</p>,
}));
vi.mock("@/app/(dashboard)/settings/_components/profile-form", () => ({
  ProfileForm: () => <p>ProfileForm</p>,
}));
vi.mock("@/app/(dashboard)/settings/_components/cursor-preference", () => ({
  CursorPreference: () => <p>CursorPreference</p>,
}));
vi.mock("@/app/(dashboard)/settings/_components/organization-section", () => ({
  OrganizationSection: ({ org, role }: { org: { id: string }; role: string }) => (
    <p>
      OrganizationSection: {org.id} / {role}
    </p>
  ),
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import SettingsPage from "@/app/(dashboard)/settings/page";
import { makeOrg } from "@/tests/support/factories";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { mockGetServerTRPC } from "@/tests/support/trpc";

describe("SettingsPage (Server Component)", () => {
  it("renders profile + cursor preference but no LabelManager without an org", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);
    render(await SettingsPage());
    expect(screen.getByText("ProfileForm")).toBeInTheDocument();
    expect(screen.getByText("CursorPreference")).toBeInTheDocument();
    expect(screen.getByText(/create an organization/i)).toBeInTheDocument();
    expect(screen.queryByText(/LabelManager/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OrganizationSection/)).not.toBeInTheDocument();
  });

  it("renders LabelManager with the fetched labels when an org exists", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    render(await SettingsPage());
    expect(screen.getByText(`LabelManager: ${VALID_ORG_ID}`)).toBeInTheDocument();
  });

  it("renders OrganizationSection for an admin/owner", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ role: "ADMIN" }));
    render(await SettingsPage());
    expect(screen.getByText(`OrganizationSection: ${VALID_ORG_ID} / ADMIN`)).toBeInTheDocument();
  });

  it("hides OrganizationSection for a non-admin member", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ role: "MEMBER" }));
    render(await SettingsPage());
    expect(screen.queryByText(/OrganizationSection/)).not.toBeInTheDocument();
  });

  it("falls back to VIEWER (hiding OrganizationSection) when the org has no memberships", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ memberships: [] }));
    render(await SettingsPage());
    expect(screen.queryByText(/OrganizationSection/)).not.toBeInTheDocument();
    expect(screen.getByText(`LabelManager: ${VALID_ORG_ID}`)).toBeInTheDocument();
  });
});
