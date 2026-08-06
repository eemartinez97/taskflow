import { render } from "react-email";
import { describe, expect, it } from "vitest";
import { VerifyEmail } from "../../src/templates/verify-email";

describe("VerifyEmail", () => {
  it("renders the recipient name and verification link in the html body", async () => {
    const html = await render(
      <VerifyEmail name="Ada" verifyUrl="https://taskflow.dev/verify?token=abc" expiresInHours={24} />,
    );

    expect(html).toContain("Ada");
    expect(html).toContain("https://taskflow.dev/verify?token=abc");
  });

  it("pluralizes the expiry window and includes the link in the plain-text rendering", async () => {
    const text = await render(
      <VerifyEmail name="Ada" verifyUrl="https://taskflow.dev/verify?token=abc" expiresInHours={24} />,
      { plainText: true },
    );

    expect(text).toContain("https://taskflow.dev/verify?token=abc");
    expect(text).toContain("expires in 24 hours");
  });

  it("uses the singular hour form when the link expires in exactly 1 hour", async () => {
    const text = await render(
      <VerifyEmail name="Ada" verifyUrl="https://taskflow.dev/verify?token=abc" expiresInHours={1} />,
      { plainText: true },
    );

    expect(text).toContain("expires in 1 hour.");
  });
});
