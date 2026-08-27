import { expect, test } from "./support/fixtures";
import { createIsolatedOrg, goToTeam, uniqueOrgName } from "./helpers/org";
import { dialogFieldByLabel } from "./helpers/field";
import { newAuthenticatedSession, registerUserViaApi } from "./helpers/auth";
import { clickNavLink } from "./helpers/nav";

test.describe("Leaving an organization", () => {
  test("a member can leave from Settings; the org disappears from their switcher and the owner is notified", async ({
    page,
    browser,
    registeredUser,
  }) => {
    const org = uniqueOrgName("Leave Org");
    await createIsolatedOrg(page, org.name);

    // The invite target must be an existing account, otherwise the mutation
    // fails with an inline error and the success toast never renders.
    await registerUserViaApi(page, registeredUser);
    const { context: memberContext, page: memberPage } = await newAuthenticatedSession(
      browser,
      registeredUser,
    );

    try {
      // Owner invites, member accepts from their notifications panel - same
      // flow as invitations.spec.ts's own admin-invites-existing-user test.
      await goToTeam(page, org.name);
      await page.getByRole("button", { name: "Invite member" }).click();
      const dialog = page.getByRole("dialog");
      await dialogFieldByLabel(page, "Email").fill(registeredUser.email);
      await dialog.getByRole("button", { name: "Send invite", exact: true }).click();
      await expect(page.getByText("Invitation sent.", { exact: true })).toBeVisible();

      await memberPage.goto("/projects");
      await memberPage.getByRole("button", { name: /notifications/i }).click();
      const acceptButton = memberPage
        .getByRole("region", { name: "Notifications" })
        .getByRole("button", { name: "Accept" });
      await expect(acceptButton).toBeVisible({ timeout: 15_000 });
      await acceptButton.click();

      // Confirm the org actually became active in the member's switcher
      // before leaving it - otherwise a passing "leave" click below could be
      // silently leaving the WRONG (already-active) org.
      await expect(memberPage.getByRole("button", { name: /switch organization/i })).toContainText(
        org.name,
        { timeout: 15_000 },
      );

      // "General" is a real sidebar link for every role, MEMBER included -
      // see settings-nav.tsx (LeaveOrgSection lives on that same page,
      // gated per-section by role, not by hiding the nav entry itself).
      await clickNavLink(memberPage, "Settings", /\/settings/);
      await clickNavLink(memberPage, "General", /\/settings\/organization/);
      await memberPage.getByRole("button", { name: "Leave", exact: true }).click();
      const leaveDialog = memberPage.getByRole("dialog");
      await leaveDialog.getByLabel(/type/i).fill(org.name);
      await leaveDialog.getByRole("button", { name: "Yes, leave", exact: true }).click();

      await expect(memberPage).toHaveURL(/\/projects/, { timeout: 15_000 });
      // This was the member's ONLY org, so the switcher falls all the way
      // back to its zero-orgs state (a "Create organization" button, not the
      // "switch organization" trigger) - confirms the departed org is gone,
      // not just that the switcher's LABEL changed.
      await expect(memberPage.getByRole("button", { name: "Create organization" })).toBeVisible({
        timeout: 15_000,
      });

      // The owner (who stayed OWNER/ADMIN) gets a MEMBER_LEFT notification.
      await page.getByRole("button", { name: /notifications/i }).click();
      await expect(page.getByText(/left/i).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await memberContext.close();
    }
  });
});
