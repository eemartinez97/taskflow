import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { CREATE_ORG_VALUE } from "@/lib/constants/org-switcher";
import { dialogFieldByLabel, fieldByLabel } from "./field";

/** Generates a collision-resistant org name/slug pair for parallel test runs. */
export function uniqueOrgName(prefix = "Test Org"): { name: string; slug: string } {
  const id = randomUUID().replace(/-/g, "").slice(0, 8);
  return {
    name: `${prefix} ${id}`,
    slug: `${prefix.toLowerCase().replace(/\s+/g, "-")}-${id}`,
  };
}

/**
 * Creates a brand-new, isolated organization from an ALREADY-AUTHENTICATED
 * session via the sidebar switcher, leaving the browser on /projects with
 * the new org active.
 *
 * WHY this exists: the default storageState (playwright.config.ts) starts
 * every test as the seeded admin, who already owns "Demo Organization"
 * (packages/database/prisma/seed.ts). Tests that mutate org-scoped state
 * (invites, labels, org rename/delete) must NOT touch Demo Organization
 * directly - it's shared fixture data read by every parallel worker AND
 * every browser project (chromium + firefox run the full suite
 * concurrently), so two runs racing to create a label named "Urgent" in the
 * same org would violate the `@@unique([orgId, name])` constraint and flake.
 * A fresh, unique, disposable org per test avoids this without paying the
 * cost of a full re-registration through /register.
 */
export async function createIsolatedOrg(page: Page, orgName: string): Promise<void> {
  await page.goto("/projects");
  await page.getByLabel("Select organization").selectOption(CREATE_ORG_VALUE);
  await dialogFieldByLabel(page, "Name").fill(orgName);
  await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/projects/);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: orgName })).toBeVisible();
}

/**
 * Completes the first-run onboarding form (reached with zero orgs).
 * Waits for the real form (not the Suspense skeleton) before typing.
 */
export async function completeOnboarding(page: Page, orgName: string): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding/);
  const submit = page.getByRole("button", { name: "Create Organization" });
  await expect(submit).toBeVisible();
  await fieldByLabel(page, "Name").fill(orgName);
  await submit.click();
  await expect(page).toHaveURL(/\/projects/);
}
