import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));
vi.mock("@/app/(dashboard)/settings/_components/settings-nav", () => ({
  SettingsNav: ({ orgName, role }: { orgName: string | null; role: string | null }) => (
    <p>
      SettingsNav: {orgName ?? "none"} / {role ?? "none"}
    </p>
  ),
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import SettingsLayout from "@/app/(dashboard)/settings/layout";
import { makeOrg } from "@/tests/support/factories";
import { mockGetServerTRPC } from "@/tests/support/trpc";

describe("SettingsLayout", () => {
  it("renders SettingsNav with the org name and role, plus children", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ name: "Acme", role: "OWNER" }));

    render(await SettingsLayout({ children: <p>Page content</p> }));

    expect(screen.getByText("SettingsNav: Acme / OWNER")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("renders SettingsNav with null org/role when there's no org", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);

    render(await SettingsLayout({ children: <p>Page content</p> }));

    expect(screen.getByText("SettingsNav: none / none")).toBeInTheDocument();
  });
});
