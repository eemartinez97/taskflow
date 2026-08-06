import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../src/types";
import { sendVerificationEmail } from "../src/send-verification-email";

function fakeSender(result: { success: boolean; error?: string }): EmailSender {
  return { send: vi.fn().mockResolvedValue(result) };
}

describe("sendVerificationEmail", () => {
  it("renders the template and sends it with the confirmation subject", async () => {
    const sender = fakeSender({ success: true });

    await sendVerificationEmail(sender, {
      to: "a@b.com",
      name: "Ada",
      verifyUrl: "https://taskflow.dev/verify?token=abc",
      expiresInHours: 24,
    });

    expect(sender.send).toHaveBeenCalledTimes(1);
    const params = vi.mocked(sender.send).mock.calls[0]?.[0];
    expect(params?.to).toBe("a@b.com");
    expect(params?.subject).toBe("Confirm your email address");
    expect(params?.html).toContain("https://taskflow.dev/verify?token=abc");
    expect(params?.html).toContain("Ada");
    expect(params?.text).toContain("https://taskflow.dev/verify?token=abc");
  });

  it("throws with the provider error when delivery fails", async () => {
    const sender = fakeSender({ success: false, error: "rate limited" });

    await expect(
      sendVerificationEmail(sender, {
        to: "a@b.com",
        name: "Ada",
        verifyUrl: "https://taskflow.dev/verify?token=abc",
        expiresInHours: 24,
      }),
    ).rejects.toThrow(/rate limited/);
  });

  it("throws a fallback message when delivery fails without an error detail", async () => {
    const sender = fakeSender({ success: false });

    await expect(
      sendVerificationEmail(sender, {
        to: "a@b.com",
        name: "Ada",
        verifyUrl: "https://taskflow.dev/verify?token=abc",
        expiresInHours: 24,
      }),
    ).rejects.toThrow(/unknown error/);
  });
});
