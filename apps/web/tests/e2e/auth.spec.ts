import { expect, test } from "./support/fixtures";
import { registerNewUser } from "./helpers/auth";
import { fieldByLabel } from "./helpers/field";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication flow", () => {
  test("a new user can register and see the no-organization state", async ({
    page,
    registeredUser,
  }) => {
    await registerNewUser(page, registeredUser);
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByText(/not part of any organization/i)).toBeVisible();

    await page.getByRole("link", { name: /or create one/i }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { name: "Create your organization" })).toBeVisible();
  });

  test("rejects registration with a weak password", async ({ page, registeredUser }) => {
    await registerNewUser(page, { ...registeredUser, password: "weak" });
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
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
});
