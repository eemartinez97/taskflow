import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/invitations/use-invitation-actions", () => ({
  useInvitationActions: vi.fn(() => ({
    accept: vi.fn(),
    decline: vi.fn(),
    isAccepting: false,
    isDeclining: false,
  })),
}));

import type { InvitationPreview } from "@taskflow/shared";
import { useInvitationActions } from "@/components/invitations/use-invitation-actions";
import { InvitationTokenClient } from "@/app/(dashboard)/invitations/[token]/_components/invitation-token-client";
import { setupRouterMock } from "@/tests/support/render";

const VALID_PREVIEW: InvitationPreview = {
  invitationId: "inv-1",
  orgId: "org-1",
  orgName: "Acme",
  role: "MEMBER",
  inviterName: "Alice",
  expiresAt: new Date("2026-06-13"),
  state: "VALID",
};

describe("InvitationTokenClient", () => {
  it("renders the org name, inviter, and role for a VALID invitation", () => {
    setupRouterMock();
    render(<InvitationTokenClient token="raw-token" preview={VALID_PREVIEW} />);
    expect(screen.getByText(/you've been invited to join acme/i)).toBeInTheDocument();
    expect(screen.getByText(/alice invited you to join as/i)).toBeInTheDocument();
    expect(screen.getByText("MEMBER")).toBeInTheDocument();
  });

  it("falls back to 'Someone' when there is no inviter name", () => {
    setupRouterMock();
    render(
      <InvitationTokenClient token="raw-token" preview={{ ...VALID_PREVIEW, inviterName: null }} />,
    );
    expect(screen.getByText(/someone invited you to join as/i)).toBeInTheDocument();
  });

  it("calls accept with the token and navigates to the org page on success", async () => {
    const { pushMock } = setupRouterMock();
    const accept = vi.fn();
    vi.mocked(useInvitationActions).mockReturnValue({
      accept,
      decline: vi.fn(),
      isAccepting: false,
      isDeclining: false,
    });
    render(<InvitationTokenClient token="raw-token" preview={VALID_PREVIEW} />);

    await userEvent.setup().click(screen.getByRole("button", { name: /accept/i }));

    expect(accept).toHaveBeenCalledWith(
      { token: "raw-token" },
      expect.objectContaining({
        onSuccess: expect.any(Function) as unknown,
      }),
    );
    const call = accept.mock.calls[0]?.[1] as { onSuccess?: (r: { orgId: string }) => void };
    call.onSuccess?.({ orgId: "org-99" });
    expect(pushMock).toHaveBeenCalledWith("/organizations/org-99");
  });

  it("calls decline with the token and navigates to /projects on success", async () => {
    const { pushMock } = setupRouterMock();
    const decline = vi.fn();
    vi.mocked(useInvitationActions).mockReturnValue({
      accept: vi.fn(),
      decline,
      isAccepting: false,
      isDeclining: false,
    });
    render(<InvitationTokenClient token="raw-token" preview={VALID_PREVIEW} />);

    await userEvent.setup().click(screen.getByRole("button", { name: /decline/i }));

    expect(decline).toHaveBeenCalledWith(
      { token: "raw-token" },
      expect.objectContaining({
        onSuccess: expect.any(Function) as unknown,
      }),
    );
    const call = decline.mock.calls[0]?.[1] as { onSuccess?: () => void };
    call.onSuccess?.();
    expect(pushMock).toHaveBeenCalledWith("/projects");
  });

  it("disables Accept/Decline while a mutation is pending", () => {
    setupRouterMock();
    vi.mocked(useInvitationActions).mockReturnValue({
      accept: vi.fn(),
      decline: vi.fn(),
      isAccepting: true,
      isDeclining: true,
    });
    render(<InvitationTokenClient token="raw-token" preview={VALID_PREVIEW} />);
    expect(screen.getByRole("button", { name: /accept/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /decline/i })).toBeDisabled();
  });

  it.each([
    ["EXPIRED", /this invitation has expired/i],
    ["REVOKED", /this invitation was revoked/i],
    ["DECLINED", /invitation already declined/i],
    ["ALREADY_ACCEPTED", /invitation already accepted/i],
    ["WRONG_ACCOUNT", /wrong account/i],
  ] as const)("renders the terminal-state copy for state=%s", (state, expectedHeading) => {
    setupRouterMock();
    render(<InvitationTokenClient token="raw-token" preview={{ ...VALID_PREVIEW, state }} />);
    expect(screen.getByRole("heading", { name: expectedHeading })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
  });
});
