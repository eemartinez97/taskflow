import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));
vi.mock("@/components/common/no-org-state", () => ({
  NoOrgState: ({ context }: { context: string }) => <p>NoOrgState: {context}</p>,
}));
vi.mock("@/app/(dashboard)/projects/_components/project-list", () => ({
  ProjectList: ({ orgId }: { orgId: string }) => <p>ProjectList: {orgId}</p>,
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import ProjectsPage from "@/app/(dashboard)/projects/page";
import { mockGetServerTRPC } from "@/tests/support/trpc";
import { makeOrg } from "@/tests/support/factories";
import { VALID_ORG_ID } from "@/tests/support/fixtures";

describe("ProjectsPage (Server Component)", () => {
  it("renders NoOrgState when the user has no organization", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);
    render(await ProjectsPage());
    expect(screen.getByText(/NoOrgState/)).toBeInTheDocument();
  });

  it("fetches and renders ProjectList when an org exists", async () => {
    const org = makeOrg();
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(org);
    render(await ProjectsPage());
    expect(screen.getByText(`ProjectList: ${VALID_ORG_ID}`)).toBeInTheDocument();
  });
});
