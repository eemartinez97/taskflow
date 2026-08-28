import { randomUUID } from "node:crypto";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { fieldByLabel } from "./field";

interface NewUserPayload {
  name: string;
  email: string;
  password: string;
}

/**
 * Generates a unique, disposable user identity - a plain function (not a
 * fixture) so one test can mint more than one identity, e.g. its OWN admin
 * plus a separately-fixtured invitee. Use for any role that would otherwise
 * default to the shared seed admin (playwright.config.ts's storageState):
 * a fresh admin per test means that test's invite/accept/decline realtime
 * toasts land in ITS OWN `user:` room instead of piling up in the seed
 * admin's notification stack alongside every other concurrently-running
 * test - see invitations.spec.ts, whose admin-directed toast volume was
 * flaking the shared-admin revoke test by covering its button.
 */
export function randomTestUser(role = "user"): NewUserPayload {
  const uniqueId = randomUUID().slice(0, 8);
  return {
    email: `e2e-${role}-${uniqueId}@taskflow.dev`,
    password: "Str0ng!Passw0rd",
    name: `E2E ${role} ${uniqueId}`,
  };
}

/**
 * Registers a user directly through apps/api's auth.register mutation,
 * bypassing the UI. Use when a test only needs the account to EXIST (e.g.
 * as an invite target) - inviteMember only checks that a User row with
 * this email exists, never its verification state.
 *
 * Registration lives in apps/api now (auth-consolidation epic), not a
 * apps/web Route Handler - this hits its tRPC HTTP endpoint directly using
 * the batch-link envelope (`?batch=1`, numbered inputs), the same wire
 * format apps/web's own browser client sends, so no extra tRPC client
 * dependency is needed just for this one call.
 */
export async function registerUserViaApi(page: Page, user: NewUserPayload): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const response = await page.request.post(`${apiUrl}/trpc/auth.register?batch=1`, {
    // page.request does NOT automatically apply any config-level headers -
    // x-e2e-secret must be attached per-call so this counts toward the
    // rate-limit bypass in apps/api/src/modules/auth/rate-limit.ts, same as
    // getEmailedToken below.
    headers: { "x-e2e-secret": process.env.E2E_TEST_SECRET ?? "" },
    data: {
      "0": {
        json: {
          name: user.name,
          email: user.email,
          password: user.password,
          confirmPassword: user.password,
        },
      },
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
 * Extracts the raw token from the most recently captured email for `email`.
 * Relies on /api/test/last-email, a backdoor route that only exists when
 * ENABLE_TEST_ROUTES=true (see playwright.config.ts) - there is no real
 * mailbox in this environment, so this is the E2E equivalent of "open the
 * email and read the link out of it".
 *
 * Hits apps/api directly (NEXT_PUBLIC_API_URL, same fallback as
 * registerUserViaApi above), NOT a relative path against apps/web's
 * baseURL: the auth-consolidation epic moved every /api/test/* route (and
 * the mail sender it reads from) onto apps/api, and apps/web has no rewrite
 * proxying that prefix back to it.
 *
 * Returns the bare token rather than navigating anywhere - callers build
 * their own destination URL, since it's a `?token=` query param for
 * verify-email/reset-password but a `/invitations/<token>` path segment (or
 * a `?invite=` param on /register) for invitations. See `followEmailedLink`
 * below for the common `?token=` case.
 *
 * The regex matches all three shapes: `token=<t>`, `invite=<t>`, and
 * `/invitations/<t>` - the raw token itself is base64url
 * (generateRawToken/tokens.ts), so `[A-Za-z0-9_-]+` is a safe charset for
 * any of them.
 */
export async function getEmailedToken(page: Page, email: string): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const response = await page.request.get(
    `${apiUrl}/api/test/last-email?to=${encodeURIComponent(email)}`,
    { headers: { "x-e2e-secret": process.env.E2E_TEST_SECRET ?? "" } },
  );
  if (!response.ok()) {
    throw new Error(
      `No email captured for ${email}. Ensure ENABLE_TEST_ROUTES=true is set for the ` +
        `web dev server (see playwright.config.ts webServer env).`,
    );
  }
  const { html } = (await response.json()) as { html: string };
  const match = /(?:token=|invite=|\/invitations\/)([A-Za-z0-9_-]+)/.exec(html);
  if (!match?.[1]) {
    throw new Error(`Could not extract a token from the captured email for ${email}.`);
  }
  return match[1];
}

/** Extracts the raw token from the most recently captured email for `email` and navigates to it. */
export async function followEmailedLink(
  page: Page,
  email: string,
  destinationPath: string,
): Promise<void> {
  const token = await getEmailedToken(page, email);
  await page.goto(`${destinationPath}?token=${token}`);
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

/**
 * Opens a brand-new, isolated browser context and fully registers+logs-in a
 * second user in it - used wherever a test needs two SIMULTANEOUS
 * authenticated sessions (e.g. an org admin sending an invite in one
 * context while the invitee sees/accepts it live in another). Callers must
 * `await context.close()` when done.
 *
 * Explicit empty storageState (not just "no option passed"): every spec
 * that registers a NEW user through the fixture-provided `page` has to
 * opt out of the default pre-authenticated storageState the same way (see
 * `test.use({ storageState: { cookies: [], origins: [] } })` in
 * auth.spec.ts / first-org-and-board-flow.spec.ts) - a manually-created
 * `browser.newContext()` needs the identical override, or proxy.ts's
 * `isAuthenticated && isPublicAuthRoute` redirect sends this "new" user
 * straight to /projects as the ALREADY-authenticated seed admin instead.
 */
export async function newAuthenticatedSession(
  browser: Browser,
  user: NewUserPayload,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await registerNewUser(page, user);
  return { context, page };
}
