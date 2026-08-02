import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/app/(dashboard)/organizations/_components/organizations-client", () => ({
  OrganizationsClient: ({ initialOrgs }: { initialOrgs: unknown[] }) => (
    <p>OrganizationsClient: {initialOrgs.length}</p>
  ),
}));

import { getServerTRPC } from "@/lib/trpc/server";
import OrganizationsPage from "@/app/(dashboard)/organizations/page";
import { mockGetServerTRPC } from "@/tests/support/trpc";
import { makeOrg } from "@/tests/support/factories";

describe("OrganizationsPage (Server Component)", () => {
  it("fetches the org list and passes it to OrganizationsClient", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      orgs: { list: vi.fn().mockResolvedValue([makeOrg(), makeOrg({ id: "o2" })]) },
    });
    render(await OrganizationsPage());
    expect(screen.getByText("OrganizationsClient: 2")).toBeInTheDocument();
  });
});
