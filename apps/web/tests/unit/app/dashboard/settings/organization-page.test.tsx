import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));
vi.mock("@/components/common/no-org-state", () => ({
  NoOrgState: ({ context }: { context: string }) => <p>NoOrgState: {context}</p>,
}));
vi.mock("@/app/(dashboard)/settings/_components/organization-section", () => ({
  OrganizationSection: ({ org, role }: { org: { name: string }; role: string }) => (
    <p>
      OrganizationSection: {org.name} / {role}
    </p>
  ),
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import OrganizationSettingsPage from "@/app/(dashboard)/settings/organization/page";
import { makeOrg } from "@/tests/support/factories";
import { mockGetServerTRPC } from "@/tests/support/trpc";

describe("OrganizationSettingsPage", () => {
  it("renders NoOrgState when there is no organization", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);

    render(await OrganizationSettingsPage());

    expect(screen.getByText(/NoOrgState/)).toBeInTheDocument();
  });

  it("shows an access-denied state for a MEMBER", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ role: "MEMBER" }));

    render(await OrganizationSettingsPage());

    expect(screen.getByText(/don't have access/i)).toBeInTheDocument();
    expect(screen.queryByText(/OrganizationSection/)).not.toBeInTheDocument();
  });

  it("shows an access-denied state for a VIEWER", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ role: "VIEWER" }));

    render(await OrganizationSettingsPage());

    expect(screen.getByText(/don't have access/i)).toBeInTheDocument();
  });

  it("renders OrganizationSection for an ADMIN", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ name: "Acme", role: "ADMIN" }));

    render(await OrganizationSettingsPage());

    expect(screen.getByRole("heading", { name: "Organization" })).toBeInTheDocument();
    expect(screen.getByText("OrganizationSection: Acme / ADMIN")).toBeInTheDocument();
  });

  it("renders OrganizationSection for an OWNER", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ name: "Acme", role: "OWNER" }));

    render(await OrganizationSettingsPage());

    expect(screen.getByText("OrganizationSection: Acme / OWNER")).toBeInTheDocument();
  });

  it("falls back to VIEWER (access-denied) when the org has no memberships", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ memberships: [] }));

    render(await OrganizationSettingsPage());

    expect(screen.getByText(/don't have access/i)).toBeInTheDocument();
  });
});
