import { render } from "react-email";
import { describe, expect, it } from "vitest";
import { AccountActivatedEmail } from "../../src/templates/account-activated";

describe("AccountActivatedEmail", () => {
  it("renders the recipient name and login link in the html body", async () => {
    const html = await render(
      <AccountActivatedEmail name="Ada" loginUrl="https://taskflow.dev/login" />,
    );

    expect(html).toContain("Ada");
    expect(html).toContain("https://taskflow.dev/login");
  });

  it("includes the login link in the plain-text rendering", async () => {
    const text = await render(
      <AccountActivatedEmail name="Ada" loginUrl="https://taskflow.dev/login" />,
      { plainText: true },
    );

    expect(text).toContain("https://taskflow.dev/login");
    expect(text).toContain("active");
  });
});
