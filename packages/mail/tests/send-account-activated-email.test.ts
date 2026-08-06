import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../src/types";
import { sendAccountActivatedEmail } from "../src/send-account-activated-email";

function fakeSender(result: { success: boolean; error?: string }): EmailSender {
  return { send: vi.fn().mockResolvedValue(result) };
}

describe("sendAccountActivatedEmail", () => {
  it("renders the template and sends it with the activation subject", async () => {
    const sender = fakeSender({ success: true });

    await sendAccountActivatedEmail(sender, {
      to: "a@b.com",
      name: "Ada",
      loginUrl: "https://taskflow.dev/login",
    });

    expect(sender.send).toHaveBeenCalledTimes(1);
    const params = vi.mocked(sender.send).mock.calls[0]?.[0];
    expect(params?.to).toBe("a@b.com");
    expect(params?.subject).toBe("Your TaskFlow account is active");
    expect(params?.html).toContain("https://taskflow.dev/login");
    expect(params?.html).toContain("Ada");
    expect(params?.text).toContain("https://taskflow.dev/login");
  });

  it("throws with the provider error when delivery fails", async () => {
    const sender = fakeSender({ success: false, error: "invalid recipient" });

    await expect(
      sendAccountActivatedEmail(sender, {
        to: "a@b.com",
        name: "Ada",
        loginUrl: "https://taskflow.dev/login",
      }),
    ).rejects.toThrow(/invalid recipient/);
  });

  it("throws a fallback message when delivery fails without an error detail", async () => {
    const sender = fakeSender({ success: false });

    await expect(
      sendAccountActivatedEmail(sender, {
        to: "a@b.com",
        name: "Ada",
        loginUrl: "https://taskflow.dev/login",
      }),
    ).rejects.toThrow(/unknown error/);
  });
});
