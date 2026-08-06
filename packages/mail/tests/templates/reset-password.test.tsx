import { render } from "react-email";
import { describe, expect, it } from "vitest";
import { ResetPasswordEmail } from "../../src/templates/reset-password";

describe("ResetPasswordEmail", () => {
  it("renders the recipient name and reset link in the html body", async () => {
    const html = await render(
      <ResetPasswordEmail
        name="Ada"
        resetUrl="https://taskflow.dev/reset?token=abc"
        expiresInHours={2}
      />,
    );

    expect(html).toContain("Ada");
    expect(html).toContain("https://taskflow.dev/reset?token=abc");
  });

  it("pluralizes the expiry window and includes the link in the plain-text rendering", async () => {
    const text = await render(
      <ResetPasswordEmail
        name="Ada"
        resetUrl="https://taskflow.dev/reset?token=abc"
        expiresInHours={2}
      />,
      { plainText: true },
    );

    expect(text).toContain("https://taskflow.dev/reset?token=abc");
    expect(text).toContain("expires in 2 hours");
  });

  it("uses the singular hour form when the link expires in exactly 1 hour", async () => {
    const text = await render(
      <ResetPasswordEmail
        name="Ada"
        resetUrl="https://taskflow.dev/reset?token=abc"
        expiresInHours={1}
      />,
      { plainText: true },
    );

    expect(text).toContain("expires in 1 hour.");
  });
});
