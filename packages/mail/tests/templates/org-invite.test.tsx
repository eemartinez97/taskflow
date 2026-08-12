import { render } from "react-email";
import { describe, expect, it } from "vitest";
import { OrgInviteEmail } from "../../src/templates/org-invite";

const BASE_PROPS = {
  orgName: "Acme Inc",
  inviterName: "Ada",
  role: "MEMBER",
  acceptUrl: "https://taskflow.dev/invitations/abc",
  expiresInHours: 168,
  isNewUser: false,
};

describe("OrgInviteEmail", () => {
  it("renders the org name, inviter, role, and accept link in the html body", async () => {
    const html = await render(<OrgInviteEmail {...BASE_PROPS} />);

    expect(html).toContain("Acme Inc");
    expect(html).toContain("Ada");
    expect(html).toContain("MEMBER");
    expect(html).toContain("https://taskflow.dev/invitations/abc");
  });

  it("shows 'View invitation' for an existing user", async () => {
    const html = await render(<OrgInviteEmail {...BASE_PROPS} isNewUser={false} />);
    expect(html).toContain("View invitation");
    expect(html).not.toContain("Create your account");
  });

  it("shows 'Create your account' for a new user", async () => {
    const html = await render(<OrgInviteEmail {...BASE_PROPS} isNewUser={true} />);
    expect(html).toContain("Create your account");
  });

  it("converts the expiry window to days in the plain-text rendering", async () => {
    const text = await render(<OrgInviteEmail {...BASE_PROPS} expiresInHours={168} />, {
      plainText: true,
    });
    expect(text).toContain("expires in 7 days");
    expect(text).toContain("https://taskflow.dev/invitations/abc");
  });

  it("uses the singular day form when the expiry is exactly 24 hours", async () => {
    const text = await render(<OrgInviteEmail {...BASE_PROPS} expiresInHours={24} />, {
      plainText: true,
    });
    expect(text).toContain("expires in 1 day.");
  });
});
