import { expect, test } from "./support/fixtures";
import { followEmailedLink, registerNewUser } from "./helpers/auth";
import { fieldByLabel } from "./helpers/field";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication flow", () => {
  test("a new user can register and see the no-organization state", async ({
    page,
    registeredUser,
  }) => {
    await registerNewUser(page, registeredUser);
    await expect(page).toHaveURL(/\/projects/);
    // .first(): under real concurrency, a just-completed client-side
    // navigation can briefly leave a second, inert copy of this heading in
    // the DOM (not exposed via the accessibility tree, but still matched by
    // getByText) while the transition settles - see the identical case in
    // first-org-and-board-flow.spec.ts.
    await expect(page.getByText(/not part of any organization/i).first()).toBeVisible();

    await page.getByRole("button", { name: "create one" }).click();
    await expect(page.getByRole("dialog", { name: "Create organization" })).toBeVisible();
  });

  test("rejects a weak password at registration", async ({ page, registeredUser }) => {
    await page.goto("/register");
    await fieldByLabel(page, "Name").fill(registeredUser.name);
    await fieldByLabel(page, "Email").fill(registeredUser.email);
    await fieldByLabel(page, "Password").fill("weak");
    await fieldByLabel(page, "Confirm Password").fill("weak");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("shows an inline error for wrong login credentials", async ({ page }) => {
    await page.goto("/login");
    await fieldByLabel(page, "Email").fill("nobody@taskflow.dev");
    await fieldByLabel(page, "Password").fill("WrongPassword1!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("an authenticated user is redirected away from /login", async ({ page, registeredUser }) => {
    await registerNewUser(page, registeredUser);
    await expect(page).toHaveURL(/\/projects/);
    await page.goto("/login");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("an unauthenticated user hitting a protected route is redirected to /login with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fprojects/);
  });

  test("user can sign out from the header", async ({ page, registeredUser }) => {
    await registerNewUser(page, registeredUser);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("a session issued before a password reset is rejected afterward", async ({
    page,
    registeredUser,
  }) => {
    // Slow: this test deliberately waits out the real 60s revocation-cache
    // TTL (see below) instead of faking it - triples the default timeout.
    test.slow();

    await registerNewUser(page, registeredUser);
    await expect(page).toHaveURL(/\/projects/);

    // Reset the password from the SAME browser context, deliberately never
    // signing out first - proxy.ts's ALWAYS_ACCESSIBLE_ROUTES keeps
    // /forgot-password and /reset-password reachable either way, and this
    // is exactly the scenario being tested: the pre-reset session cookie
    // stays in this context, untouched, for the rest of the test.
    await page.goto("/forgot-password");
    await fieldByLabel(page, "Email").fill(registeredUser.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();

    await followEmailedLink(page, registeredUser.email, "/reset-password");
    const newPassword = "N3w!Str0ngPassw0rd";
    await fieldByLabel(page, "New Password").fill(newPassword);
    await fieldByLabel(page, "Confirm New Password").fill(newPassword);
    await page.getByRole("button", { name: "Reset password" }).click();
    // TokenPasswordForm pushes /login?reset=1, but the OLD session cookie
    // is STILL valid at this exact moment - proxy.ts's "authenticated user
    // visiting /login" rule bounces that straight back to /projects. Either
    // landing spot confirms the reset itself completed; only wait for
    // reset-password to be behind us.
    await page.waitForURL((url) => !url.pathname.startsWith("/reset-password"), {
      timeout: 10_000,
    });

    // The revocation check (lib/auth/session-revocation.ts) is backed by an
    // in-process passwordChangedAt cache with a real 60s TTL, PER MODULE
    // INSTANCE - Next.js compiles Route Handlers and RSC page renders into
    // separate bundles, each getting its OWN copy of that cache, so there is
    // no reliable single place to force-bust it from a test. Waiting out the
    // real TTL is the only correct way to observe "eventually revoked,
    // within 60s" - which is the actual documented guarantee, not an
    // artifact of this test being slow.
    await page.waitForTimeout(61_000);

    // Reuse the ORIGINAL (pre-reset) session cookie, still held by this
    // browser context, to prove it no longer authenticates: the RSC session
    // check now re-reads passwordChangedAt from the DB, sees it postdates
    // this cookie's `iat`, and the protectedProcedure powering /projects'
    // org data throws UNAUTHORIZED. (dashboard)/error.tsx catches that and
    // renders its fallback in place of the org content - the HTTP status
    // stays 200 (RSC streaming had already committed to it before the
    // throw). Header/Sidebar stay up (error.tsx only replaces `{children}`,
    // per Next's error-boundary scoping - see its own docblock), so the
    // still-visible "Projects" title in the header is NOT a useful signal
    // here; the error fallback's own heading is.
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toBeVisible();

    // The fallback's own recovery path: clears the dead cookie client-side
    // and lands back on /login, breaking the loop proxy.ts would otherwise
    // cause (it only checks JWT validity, not revocation - see error.tsx's
    // docblock) - confirms the boundary is actually usable, not just visible.
    await page.getByRole("button", { name: /sign in again/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    // And confirm the new password actually works, on a clean session.
    await fieldByLabel(page, "Email").fill(registeredUser.email);
    await fieldByLabel(page, "Password").fill(newPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/projects/, { timeout: 15_000 });
  });
});
