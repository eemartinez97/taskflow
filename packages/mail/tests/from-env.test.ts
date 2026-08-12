import { describe, expect, it } from "vitest";
import { createEmailSenderFromEnv } from "../src/from-env";
import { ConsoleEmailSender } from "../src/providers/console";
import { ResendEmailSender } from "../src/providers/resend";

describe("createEmailSenderFromEnv", () => {
  it("returns a ConsoleEmailSender in dev when RESEND_API_KEY is absent", () => {
    const sender = createEmailSenderFromEnv({
      EMAIL_FROM: "test@example.com",
      isProduction: false,
    });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  it("returns a ResendEmailSender when RESEND_API_KEY is present", () => {
    const sender = createEmailSenderFromEnv({
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "test@example.com",
      isProduction: false,
    });
    expect(sender).toBeInstanceOf(ResendEmailSender);
  });

  it("throws in production when RESEND_API_KEY is missing", () => {
    expect(() =>
      createEmailSenderFromEnv({ EMAIL_FROM: "test@example.com", isProduction: true }),
    ).toThrow(/RESEND_API_KEY is required/);
  });
});
