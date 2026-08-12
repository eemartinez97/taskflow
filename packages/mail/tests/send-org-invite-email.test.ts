import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../src/types";
import { sendOrgInviteEmail } from "../src/send-org-invite-email";

function fakeSender(result: { success: boolean; error?: string }): EmailSender {
  return { send: vi.fn().mockResolvedValue(result) };
}

const BASE_PARAMS = {
  to: "invitee@example.com",
  orgName: "Acme Inc",
  inviterName: "Ada",
  role: "MEMBER",
  acceptUrl: "https://taskflow.dev/invitations/abc",
  expiresInHours: 168,
  isNewUser: false,
};

describe("sendOrgInviteEmail", () => {
  it("renders the template and sends it with an inviter/org-specific subject", async () => {
    const sender = fakeSender({ success: true });

    await sendOrgInviteEmail(sender, BASE_PARAMS);

    expect(sender.send).toHaveBeenCalledTimes(1);
    const params = vi.mocked(sender.send).mock.calls[0]?.[0];
    expect(params?.to).toBe("invitee@example.com");
    expect(params?.subject).toBe("Ada invited you to join Acme Inc on TaskFlow");
    expect(params?.html).toContain("https://taskflow.dev/invitations/abc");
    expect(params?.html).toContain("Acme Inc");
    expect(params?.text).toContain("https://taskflow.dev/invitations/abc");
  });

  it("throws with the provider error when delivery fails", async () => {
    const sender = fakeSender({ success: false, error: "rate limited" });

    await expect(sendOrgInviteEmail(sender, BASE_PARAMS)).rejects.toThrow(/rate limited/);
  });

  it("throws a fallback message when delivery fails without an error detail", async () => {
    const sender = fakeSender({ success: false });

    await expect(sendOrgInviteEmail(sender, BASE_PARAMS)).rejects.toThrow(/unknown error/);
  });
});
