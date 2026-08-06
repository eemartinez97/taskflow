import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../src/types";
import { sendPasswordResetEmail } from "../src/send-password-reset-email";
import { EmailDeliveryError } from "../src/errors";

function fakeSender(result: { success: boolean; error?: string }): EmailSender {
  return { send: vi.fn().mockResolvedValue(result) };
}

describe("sendPasswordResetEmail", () => {
  it("renders the template and sends it with the reset subject", async () => {
    const sender = fakeSender({ success: true });

    await sendPasswordResetEmail(sender, {
      to: "a@b.com",
      name: "Ada",
      resetUrl: "https://taskflow.dev/reset?token=abc",
      expiresInHours: 1,
    });

    expect(sender.send).toHaveBeenCalledTimes(1);
    const params = vi.mocked(sender.send).mock.calls[0]?.[0];
    expect(params?.to).toBe("a@b.com");
    expect(params?.subject).toBe("Reset your password");
    expect(params?.html).toContain("https://taskflow.dev/reset?token=abc");
    expect(params?.html).toContain("Ada");
    expect(params?.text).toContain("https://taskflow.dev/reset?token=abc");
  });

  it("throws an EmailDeliveryError with the provider error when delivery fails", async () => {
    const sender = fakeSender({ success: false, error: "invalid recipient" });

    await expect(
      sendPasswordResetEmail(sender, {
        to: "a@b.com",
        name: "Ada",
        resetUrl: "https://taskflow.dev/reset?token=abc",
        expiresInHours: 1,
      }),
    ).rejects.toThrow(EmailDeliveryError);
    await expect(
      sendPasswordResetEmail(sender, {
        to: "a@b.com",
        name: "Ada",
        resetUrl: "https://taskflow.dev/reset?token=abc",
        expiresInHours: 1,
      }),
    ).rejects.toThrow(/invalid recipient/);
  });

  it("throws a fallback message when delivery fails without an error detail", async () => {
    const sender = fakeSender({ success: false });

    await expect(
      sendPasswordResetEmail(sender, {
        to: "a@b.com",
        name: "Ada",
        resetUrl: "https://taskflow.dev/reset?token=abc",
        expiresInHours: 1,
      }),
    ).rejects.toThrow(/unknown error/);
  });
});
