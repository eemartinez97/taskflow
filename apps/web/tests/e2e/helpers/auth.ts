import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { fieldByLabel } from "./field";

interface NewUserPayload {
  name: string;
  email: string;
  password: string;
}

/**
 * Registers a user directly through the Route Handler, bypassing the UI.
 * Use when a test only needs the account to EXIST (e.g. as an invite
 * target) - inviteMember only checks that a User row with this email
 * exists, never its verification state.
 */
export async function registerUserViaApi(page: Page, user: NewUserPayload): Promise<void> {
  const response = await page.request.post("/api/auth/register", {
    data: {
      name: user.name,
      email: user.email,
      password: user.password,
      confirmPassword: user.password,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to register invite target ${user.email}: ${String(response.status())}`);
  }
}

/**
 * Drives registration through the UI (name + email + password) and waits
 * for the "check your email" confirmation. Exported separately from
 * `registerNewUser` so tests that only care about submitting the form (or
 * need to stop before confirming, e.g. weak-password validation) don't run
 * the full flow.
 */
export async function registerViaUI(page: Page, user: NewUserPayload): Promise<void> {
  await page.goto("/register");
  await fieldByLabel(page, "Name").fill(user.name);
  await fieldByLabel(page, "Email").fill(user.email);
  await fieldByLabel(page, "Password").fill(user.password);
  await fieldByLabel(page, "Confirm Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
}

/**
 * Extracts the raw token from the most recently captured email for `email`
 * and navigates to it. Relies on /api/test/last-email, a backdoor route
 * that only exists when ENABLE_TEST_ROUTES=true (see playwright.config.ts) -
 * there is no real mailbox in this environment, so this is the E2E
 * equivalent of "open the email and click the link".
 */
export async function followEmailedLink(
  page: Page,
  email: string,
  destinationPath: string,
): Promise<void> {
  const response = await page.request.get(`/api/test/last-email?to=${encodeURIComponent(email)}`, {
    headers: { "x-e2e-secret": process.env.E2E_TEST_SECRET ?? "" },
  });
  if (!response.ok()) {
    throw new Error(
      `No email captured for ${email}. Ensure ENABLE_TEST_ROUTES=true is set for the ` +
        `web dev server (see playwright.config.ts webServer env).`,
    );
  }
  const { html } = (await response.json()) as { html: string };
  const match = /token=([^"&\s]+)/.exec(html);
  if (!match?.[1]) {
    throw new Error(`Could not extract a token from the captured email for ${email}.`);
  }
  await page.goto(`${destinationPath}?token=${match[1]}`);
}

/**
 * Follows the emailed confirmation link - opening it activates the account
 * and redirects straight to /login, no separate confirm click.
 */
export async function verifyEmailViaLink(page: Page, email: string): Promise<void> {
  await followEmailedLink(page, email, "/verify-email");
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}

/** Full registration through the UI, ending on an authenticated session. */
export async function registerNewUser(page: Page, user: NewUserPayload): Promise<void> {
  await registerViaUI(page, user);
  await verifyEmailViaLink(page, user.email);
  await fieldByLabel(page, "Email").fill(user.email);
  await fieldByLabel(page, "Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/projects/, { timeout: 15_000 });
}
