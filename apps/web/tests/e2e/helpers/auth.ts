import type { Page, BrowserContext } from "@playwright/test";
import { expect } from "@playwright/test";
import { SEED_USER } from "../support/seed-user";
import { fieldByLabel } from "./field";

interface NewUserPayload {
  name: string;
  email: string;
  password: string;
}

/**
 * Registers a user directly through the Route Handler, bypassing the UI.
 * Use when a test only needs the account to EXIST (e.g. as an invite target),
 * not an authenticated session for it.
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

export async function registerNewUser(page: Page, user: NewUserPayload): Promise<void> {
  await page.goto("/register");
  await fieldByLabel(page, "Name").fill(user.name);
  await fieldByLabel(page, "Email").fill(user.email);
  await fieldByLabel(page, "Password").fill(user.password);
  await fieldByLabel(page, "Confirm Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function loginAs(
  context: BrowserContext,
  credentials: { email: string; password: string } = SEED_USER,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/login");
  await fieldByLabel(page, "Email").fill(credentials.email);
  await fieldByLabel(page, "Password").fill(credentials.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/projects/, { timeout: 15_000 });
  return page;
}

export async function expectProjectsPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/projects/);
}
