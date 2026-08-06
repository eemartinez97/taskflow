import { describe, expect, it } from "vitest";
import { createEmailSender } from "../src/factory";
import { ConsoleEmailSender } from "../src/providers/console";
import { ResendEmailSender } from "../src/providers/resend";

describe("createEmailSender", () => {
  it("returns a ConsoleEmailSender in dev when no API key is configured", () => {
    const sender = createEmailSender({ from: "test@example.com", isProduction: false });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  it("returns a ResendEmailSender in dev when an API key IS configured", () => {
    const sender = createEmailSender({
      resendApiKey: "re_test_key",
      from: "test@example.com",
      isProduction: false,
    });
    expect(sender).toBeInstanceOf(ResendEmailSender);
  });

  it("throws in production when the API key is missing", () => {
    expect(() => createEmailSender({ from: "test@example.com", isProduction: true })).toThrow(
      /RESEND_API_KEY is required/,
    );
  });

  it("returns a ResendEmailSender in production when the API key is present", () => {
    const sender = createEmailSender({
      resendApiKey: "re_test_key",
      from: "test@example.com",
      isProduction: true,
    });
    expect(sender).toBeInstanceOf(ResendEmailSender);
  });

  it("throws in production when `from` is still the Resend sandbox address", () => {
    expect(() =>
      createEmailSender({
        resendApiKey: "re_test_key",
        from: "TaskFlow <onboarding@resend.dev>",
        isProduction: true,
      }),
    ).toThrow(/onboarding@resend\.dev sandbox address/);
  });
});
