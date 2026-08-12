import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));

vi.mock("@/app/(dashboard)/invitations/[token]/_components/invitation-token-client", () => ({
  InvitationTokenClient: ({
    token,
    preview,
  }: {
    token: string;
    preview: { state: string; orgName: string };
  }) => (
    <p>
      InvitationTokenClient: {token} / {preview.state} / {preview.orgName}
    </p>
  ),
}));

import { notFound } from "next/navigation";
import { getServerTRPC } from "@/lib/trpc/server";
import InvitationTokenPage from "@/app/(dashboard)/invitations/[token]/page";
import { mockGetServerTRPC } from "@/tests/support/trpc";

function params(token = "raw-token"): Promise<{ token: string }> {
  return Promise.resolve({ token });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InvitationTokenPage", () => {
  it("renders InvitationTokenClient with the resolved preview", async () => {
    const getByToken = vi.fn().mockResolvedValue({
      invitationId: "inv-1",
      orgId: "org-1",
      orgName: "Acme",
      role: "MEMBER",
      inviterName: "Alice",
      expiresAt: new Date("2026-06-13"),
      state: "VALID",
    });
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { getByToken } });

    render(await InvitationTokenPage({ params: params("raw-token") }));

    expect(getByToken).toHaveBeenCalledWith({ token: "raw-token" });
    expect(screen.getByText("InvitationTokenClient: raw-token / VALID / Acme")).toBeInTheDocument();
  });

  it("calls notFound() when the token doesn't resolve to any invitation", async () => {
    const getByToken = vi.fn().mockRejectedValue(new Error("NOT_FOUND"));
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { getByToken } });
    vi.mocked(notFound).mockImplementationOnce(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(InvitationTokenPage({ params: params("bad-token") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
