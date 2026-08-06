import { render } from "react-email";
import { describe, expect, it } from "vitest";
import { EmailLayout } from "../../src/templates/components/email-layout";

describe("EmailLayout", () => {
  it("renders the preview text, brand name, and children", async () => {
    const html = await render(
      <EmailLayout previewText="Preview me">
        <p>Body content</p>
      </EmailLayout>,
    );

    expect(html).toContain("Preview me");
    expect(html).toContain("TaskFlow");
    expect(html).toContain("Body content");
  });
});
