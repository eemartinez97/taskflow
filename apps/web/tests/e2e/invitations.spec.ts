import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createIsolatedOrg, goToTeam, uniqueOrgName } from "./helpers/org";
import { dialogFieldByLabel, fieldByLabel } from "./helpers/field";
import { getEmailedToken, newAuthenticatedSession } from "./helpers/auth";

/**
 * Full invitation lifecycle, end to end. Because the auth-consolidation
 * epic moved /api/test/last-email next to the real mail sender, every step
 * here reads the ACTUAL captured email and follows the ACTUAL link inside
 * it - no seeded/fabricated tokens anywhere in this file.
 */

async function sendInvite(page: Page, email: string): Promise<void> {
  await page.getByRole("button", { name: "Invite member" }).click();
  await dialogFieldByLabel(page, "Email").fill(email);
  await page.getByRole("dialog").getByRole("button", { name: "Send invite", exact: true }).click();
  // Exact match: a loose /invitation sent/i also matches the (still-mounted-
  // but-closed) revoke ConfirmDialog's "Revoke the invitation sent to X?"
  // description elsewhere on this same page.
  await expect(page.getByText("Invitation sent.", { exact: true })).toBeVisible();
}

/**
 * Confirms `orgName` shows up among the switcher's own org list - proof
 * that accepting an invitation actually updated `orgs.list`, not just that
 * SOME realtime event fired. Opens the menu (its org rows only exist in the
 * DOM while open - see org-switcher.tsx) rather than leaving it open across
 * a `.poll()`, since Playwright's own `toBeVisible` already retries.
 */
async function expectOrgInSwitcher(page: Page, orgName: string): Promise<void> {
  await page.getByRole("button", { name: /switch organization/i }).click();
  await expect(page.getByRole("menu").getByText(orgName)).toBeVisible({ timeout: 15_000 });
}

test.describe("Invitation lifecycle", () => {
  test("admin invites an existing user without growing membership; invitee accepts from notifications; inviter is notified", async ({
    page,
    browser,
    registeredUser,
  }) => {
    const org = uniqueOrgName("Invite Org");
    await createIsolatedOrg(page, org.name);

    const { context: inviteeContext, page: inviteePage } = await newAuthenticatedSession(
      browser,
      registeredUser,
    );

    try {
      await goToTeam(page, org.name);
      await sendInvite(page, registeredUser.email);

      // Core behavioral change: the invitee did NOT join the org yet.
      await expect(page.getByText("PENDING")).toBeVisible();
      await expect(page.getByText("Members (1)")).toBeVisible();

      // Invitee sees + accepts it live, from the notifications panel.
      // Scoped to the panel: a zero-org invitee also renders the SAME
      // invite as an Accept/Decline card via NoOrgState's PendingInvitations
      // on this very page, so an unscoped lookup is ambiguous.
      await inviteePage.goto("/projects");
      await inviteePage.getByRole("button", { name: /notifications/i }).click();
      const notificationsPanel = inviteePage.getByRole("region", { name: "Notifications" });
      const acceptButton = notificationsPanel.getByRole("button", { name: "Accept" });
      await expect(acceptButton).toBeVisible({ timeout: 15_000 });
      await acceptButton.click();

      // The org appears in the invitee's switcher.
      await expectOrgInSwitcher(inviteePage, org.name);

      // The inviter gets an INVITATION_ACCEPTED notification.
      // .first(): under real concurrency a just-completed client-side
      // transition can briefly leave a second, inert copy of the message in
      // the DOM (same pattern documented in other specs in this suite).
      await page.getByRole("button", { name: /notifications/i }).click();
      await expect(page.getByText(/accepted your invitation/i).first()).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await inviteeContext.close();
    }
  });

  test("invitee declines from the pending-invitations card; admin sees DECLINED; re-inviting produces exactly one PENDING row", async ({
    page,
    browser,
    registeredUser,
  }) => {
    const org = uniqueOrgName("Decline Org");
    await createIsolatedOrg(page, org.name);

    const { context: inviteeContext, page: inviteePage } = await newAuthenticatedSession(
      browser,
      registeredUser,
    );

    try {
      await goToTeam(page, org.name);
      await sendInvite(page, registeredUser.email);

      // A brand-new user has zero orgs -> NoOrgState renders PendingInvitations.
      await inviteePage.goto("/projects");
      const declineButton = inviteePage.getByRole("button", { name: "Decline" });
      await expect(declineButton).toBeVisible({ timeout: 15_000 });
      await declineButton.click();

      // Admin's table flips to DECLINED live. exact: true - a page-wide
      // /declined/i also matches the "... declined your invitation ..."
      // realtime toast that pops at the same moment.
      await expect(page.getByText("DECLINED", { exact: true })).toBeVisible({ timeout: 15_000 });

      // Re-inviting the same address: exactly one row, back to PENDING.
      await sendInvite(page, registeredUser.email);
      await expect(page.getByText("PENDING")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(registeredUser.email)).toHaveCount(1);
    } finally {
      await inviteeContext.close();
    }
  });

  test("admin revokes a pending invite; the row flips to REVOKED and the invitee's pending list empties", async ({
    page,
    browser,
    registeredUser,
  }) => {
    const org = uniqueOrgName("Revoke Org");
    await createIsolatedOrg(page, org.name);

    const { context: inviteeContext, page: inviteePage } = await newAuthenticatedSession(
      browser,
      registeredUser,
    );

    try {
      await goToTeam(page, org.name);
      await sendInvite(page, registeredUser.email);

      await inviteePage.goto("/projects");
      await expect(inviteePage.getByText(org.name)).toBeVisible({ timeout: 15_000 });

      await page
        .getByRole("button", {
          name: new RegExp(`revoke invitation to ${registeredUser.email}`, "i"),
        })
        .click();
      await page.getByRole("dialog").getByRole("button", { name: "Revoke", exact: true }).click();
      // exact: true - a loose match also catches the "Invitation revoked."
      // toast (getByText is case-insensitive by default).
      await expect(page.getByText("REVOKED", { exact: true })).toBeVisible();

      // The invitee's pending-invitations card has no realtime subscription
      // of its own (REVOKED only broadcasts to the org: room, which a
      // pending invitee - not yet a member - never joins) - force a fresh
      // server fetch instead, same rationale as createIsolatedOrg's reload.
      await inviteePage.reload();
      await expect(inviteePage.getByText(org.name)).not.toBeVisible({ timeout: 15_000 });
    } finally {
      await inviteeContext.close();
    }
  });

  test("emailed deep link: the invitee accepts via /invitations/<token>; a different signed-in user sees WRONG_ACCOUNT", async ({
    page,
    browser,
    registeredUser,
  }) => {
    const org = uniqueOrgName("Deep Link Org");
    await createIsolatedOrg(page, org.name);

    const { context: inviteeContext, page: inviteePage } = await newAuthenticatedSession(
      browser,
      registeredUser,
    );
    const wrongUser = {
      name: "Wrong Account",
      email: `e2e-wrong-${randomUUID().slice(0, 8)}@taskflow.dev`,
      password: "Str0ng!Passw0rd",
    };
    const { context: wrongContext, page: wrongPage } = await newAuthenticatedSession(
      browser,
      wrongUser,
    );

    try {
      await goToTeam(page, org.name);
      await sendInvite(page, registeredUser.email);

      const token = await getEmailedToken(wrongPage, registeredUser.email);

      // A signed-in user who ISN'T the invitee must never see who the real one is.
      await wrongPage.goto(`/invitations/${token}`);
      await expect(wrongPage.getByRole("heading", { name: /wrong account/i })).toBeVisible();

      // The real invitee, following the same deep link, can accept.
      // .first(): a just-completed client-side transition can briefly leave
      // a second, inert copy of the heading in the DOM.
      await inviteePage.goto(`/invitations/${token}`);
      await expect(inviteePage.getByText(/you've been invited to join/i).first()).toBeVisible();
      await inviteePage.getByRole("button", { name: "Accept" }).click();

      await expectOrgInSwitcher(inviteePage, org.name);
    } finally {
      await inviteeContext.close();
      await wrongContext.close();
    }
  });

  test("unregistered invitee: register with the prefilled read-only email, verify, log in, and accept", async ({
    page,
    browser,
    registeredUser,
  }) => {
    const org = uniqueOrgName("Fresh Invite Org");
    await createIsolatedOrg(page, org.name);

    // Sanity check the "existing user" path stays a no-op for a fresh address.
    await goToTeam(page, org.name);
    await sendInvite(page, registeredUser.email);
    await expect(page.getByText("Members (1)")).toBeVisible();

    const inviteeContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const inviteePage = await inviteeContext.newPage();

    try {
      const inviteToken = await getEmailedToken(inviteePage, registeredUser.email);
      await inviteePage.goto(`/register?invite=${inviteToken}`);

      const emailField = fieldByLabel(inviteePage, "Email");
      await expect(emailField).toHaveValue(registeredUser.email);
      await expect(emailField).toHaveAttribute("readonly", "");
      // .first(): a just-completed client-side transition can briefly leave
      // a second, inert copy of the banner in the DOM.
      await expect(inviteePage.getByText(/you've been invited to join/i).first()).toBeVisible();

      await fieldByLabel(inviteePage, "Name").fill(registeredUser.name);
      await fieldByLabel(inviteePage, "Password").fill(registeredUser.password);
      await fieldByLabel(inviteePage, "Confirm Password").fill(registeredUser.password);
      await inviteePage.getByRole("button", { name: "Create account" }).click();
      await expect(inviteePage.getByRole("heading", { name: /check your email/i })).toBeVisible();

      const verifyToken = await getEmailedToken(inviteePage, registeredUser.email);
      await inviteePage.goto(`/verify-email?token=${verifyToken}`);
      await inviteePage.waitForURL(/\/login/, { timeout: 10_000 });

      await fieldByLabel(inviteePage, "Email").fill(registeredUser.email);
      await fieldByLabel(inviteePage, "Password").fill(registeredUser.password);
      await inviteePage.getByRole("button", { name: /sign in/i }).click();
      await inviteePage.waitForURL(/\/projects/, { timeout: 15_000 });

      // Verifying the email claims the pending invite as a notification -
      // it must NOT auto-join the org.
      const acceptButton = inviteePage.getByRole("button", { name: "Accept" });
      await expect(acceptButton).toBeVisible({ timeout: 15_000 });
      await acceptButton.click();

      await expectOrgInSwitcher(inviteePage, org.name);
    } finally {
      await inviteeContext.close();
    }
  });
});
