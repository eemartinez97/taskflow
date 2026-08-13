import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));
vi.mock("@/app/(dashboard)/settings/_components/cursor-preference", () => ({
  CursorPreference: ({ orgId }: { orgId: string }) => <p>CursorPreference: {orgId}</p>,
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import PreferencesSettingsPage from "@/app/(dashboard)/settings/preferences/page";
import { makeOrg } from "@/tests/support/factories";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { mockGetServerTRPC } from "@/tests/support/trpc";

describe("PreferencesSettingsPage", () => {
  it("renders the Preferences heading and the cursor preference card when an org exists", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ id: VALID_ORG_ID }));

    render(await PreferencesSettingsPage());

    expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.getByText(`CursorPreference: ${VALID_ORG_ID}`)).toBeInTheDocument();
  });

  it("hides the cursor preference card when there is no organization", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);

    render(await PreferencesSettingsPage());

    expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.queryByText(/CursorPreference/)).not.toBeInTheDocument();
  });
});
