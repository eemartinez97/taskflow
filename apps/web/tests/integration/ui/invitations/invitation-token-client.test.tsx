import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import type { InvitationPreview } from "@taskflow/shared";
import { InvitationTokenClient } from "@/app/(dashboard)/invitations/[token]/_components/invitation-token-client";
import { api } from "@/lib/trpc/client";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

vi.mock("@/lib/utils/active-org", () => ({ setActiveOrgId: vi.fn() }));

const VALID_PREVIEW: InvitationPreview = {
  invitationId: "inv-1",
  orgId: "org-1",
  orgName: "Acme",
  role: "MEMBER",
  inviterName: "Alice",
  expiresAt: new Date("2026-06-13"),
  state: "VALID",
};

let acceptMutation: ReturnType<typeof wireCapturableMutation>;
let declineMutation: ReturnType<typeof wireCapturableMutation>;

describe("InvitationTokenClient", () => {
  beforeEach(() => {
    mockApiUtils();
    acceptMutation = wireCapturableMutation(api.invitations.accept);
    declineMutation = wireCapturableMutation(api.invitations.decline);
  });

  it("renders the org invite details for a VALID invitation", () => {
    setupRouterMock();
    renderUI(<InvitationTokenClient token="raw-token" preview={VALID_PREVIEW} />);
    expect(screen.getByText(/you've been invited to join acme/i)).toBeInTheDocument();
  });

  it("accepts with the token when Accept is clicked", () => {
    setupRouterMock();
    renderUI(<InvitationTokenClient token="raw-token" preview={VALID_PREVIEW} />);

    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(acceptMutation.mutate).toHaveBeenCalledWith(
      { token: "raw-token" },
      expect.objectContaining({ onSuccess: expect.any(Function) as unknown }),
    );
  });

  it("declines with the token when Decline is clicked", () => {
    setupRouterMock();
    renderUI(<InvitationTokenClient token="raw-token" preview={VALID_PREVIEW} />);

    fireEvent.click(screen.getByRole("button", { name: /decline/i }));
    expect(declineMutation.mutate).toHaveBeenCalledWith(
      { token: "raw-token" },
      expect.objectContaining({ onSuccess: expect.any(Function) as unknown }),
    );
  });

  it("renders a terminal state with no action buttons", () => {
    setupRouterMock();
    renderUI(
      <InvitationTokenClient token="raw-token" preview={{ ...VALID_PREVIEW, state: "EXPIRED" }} />,
    );
    expect(screen.getByText(/this invitation has expired/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
  });
});
