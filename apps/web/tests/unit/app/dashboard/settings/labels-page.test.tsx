import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));
vi.mock("@/components/common/no-org-state", () => ({
  NoOrgState: ({ context }: { context: string }) => <p>NoOrgState: {context}</p>,
}));
vi.mock("@/app/(dashboard)/settings/_components/label-manager", () => ({
  LabelManager: ({
    orgId,
    initialLabels,
    canManage,
  }: {
    orgId: string;
    initialLabels: unknown[];
    canManage: boolean;
  }) => (
    <p>
      LabelManager: {orgId} / {initialLabels.length} labels / canManage={String(canManage)}
    </p>
  ),
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import LabelsSettingsPage from "@/app/(dashboard)/settings/labels/page";
import { makeOrg } from "@/tests/support/factories";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { mockGetServerTRPC } from "@/tests/support/trpc";

describe("LabelsSettingsPage", () => {
  it("renders NoOrgState when there is no organization", async () => {
    const list = vi.fn();
    mockGetServerTRPC(vi.mocked(getServerTRPC), { labels: { list } });
    vi.mocked(getOrgOrNull).mockResolvedValue(null);

    render(await LabelsSettingsPage());

    expect(screen.getByText(/NoOrgState/)).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it("renders LabelManager with canManage=false for a VIEWER (read-only)", async () => {
    const list = vi.fn().mockResolvedValue([{ id: "l1" }]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { labels: { list } });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ id: VALID_ORG_ID, role: "VIEWER" }));

    render(await LabelsSettingsPage());

    expect(list).toHaveBeenCalledWith({ orgId: VALID_ORG_ID });
    expect(
      screen.getByText(`LabelManager: ${VALID_ORG_ID} / 1 labels / canManage=false`),
    ).toBeInTheDocument();
  });

  it("renders LabelManager with canManage=false for a MEMBER", async () => {
    const list = vi.fn().mockResolvedValue([{ id: "l1" }]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { labels: { list } });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ id: VALID_ORG_ID, role: "MEMBER" }));

    render(await LabelsSettingsPage());

    expect(list).toHaveBeenCalledWith({ orgId: VALID_ORG_ID });
    expect(
      screen.getByText(`LabelManager: ${VALID_ORG_ID} / 1 labels / canManage=false`),
    ).toBeInTheDocument();
  });

  it("renders LabelManager with canManage=true for an ADMIN", async () => {
    const list = vi.fn().mockResolvedValue([]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { labels: { list } });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ id: VALID_ORG_ID, role: "ADMIN" }));

    render(await LabelsSettingsPage());

    expect(
      screen.getByText(`LabelManager: ${VALID_ORG_ID} / 0 labels / canManage=true`),
    ).toBeInTheDocument();
  });

  it("renders LabelManager with canManage=true for an OWNER", async () => {
    const list = vi.fn().mockResolvedValue([]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { labels: { list } });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ id: VALID_ORG_ID, role: "OWNER" }));

    render(await LabelsSettingsPage());

    expect(screen.getByRole("heading", { name: "Labels" })).toBeInTheDocument();
    expect(
      screen.getByText(`LabelManager: ${VALID_ORG_ID} / 0 labels / canManage=true`),
    ).toBeInTheDocument();
  });

  it("falls back to VIEWER (canManage=false) when the org has no memberships", async () => {
    const list = vi.fn().mockResolvedValue([]);
    mockGetServerTRPC(vi.mocked(getServerTRPC), { labels: { list } });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ id: VALID_ORG_ID, memberships: [] }));

    render(await LabelsSettingsPage());

    expect(
      screen.getByText(`LabelManager: ${VALID_ORG_ID} / 0 labels / canManage=false`),
    ).toBeInTheDocument();
  });
});
