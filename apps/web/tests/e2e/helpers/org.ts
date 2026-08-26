import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { ACTIVE_ORG_COOKIE } from "@/lib/utils/active-org";
import { dialogFieldByLabel } from "./field";
import { trackOrgForCleanup } from "./org-cleanup";
import { clickNavLink } from "./nav";

/** Matches org-switcher.tsx's own trigger aria-label prefix. */
const SWITCHER_TRIGGER_NAME = /switch organization/i;

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
 *
 * Member/invitation management lives at /team, a sidebar nav item scoped to
 * whichever org the switcher currently has active - not picked by name.
 * Reach it via `goToTeam` below.
 */
export async function createIsolatedOrg(page: Page, orgName: string): Promise<void> {
  await page.goto("/projects");
  await page.getByRole("button", { name: SWITCHER_TRIGGER_NAME }).click();
  await page.getByRole("menuitem", { name: /create organization/i }).click();
  await dialogFieldByLabel(page, "Name").fill(orgName);
  await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/projects/);
  await expect(page.getByRole("dialog")).toBeHidden();
  // Wait for the REAL condition instead of a fixed sleep: the trigger only
  // shows the new org once the client has refetched/re-rendered the org
  // list post-creation. That refetch gets slower as the seeded admin (shared
  // by every test in the whole run) accumulates more disposable orgs over
  // the life of the suite - a fixed sleep that passes early in a run starts
  // failing later, which is exactly the "fewer workers / more repeats"
  // symptom. Polling with a generous timeout self-adjusts to that.
  const switcherTrigger = page.getByRole("button", { name: SWITCHER_TRIGGER_NAME });
  await expect(switcherTrigger).toContainText(orgName, { timeout: 15_000 });
  // /projects itself titles its content with the active org's name
  // (project-list.tsx's own "projects-heading") - a second, independent
  // signal (beyond the trigger's own text) that the new org is fully active.
  const heading = page.getByRole("heading", { name: orgName });
  try {
    // Short first attempt: the common case is just a slower-than-usual
    // client refetch (see the switcher-vs-repeat-each rationale above).
    await expect(heading).toBeVisible({ timeout: 8_000 });
  } catch {
    // Rare divergence between the switcher's own text (already updated)
    // and whatever query paints this heading (still stale) - observed
    // under real concurrency, not reproducible on demand. A reload forces
    // a fresh server fetch, bypassing any stuck client-side cache entry.
    // If this ALSO fails, it's a genuine app-side cache-invalidation bug
    // (the org-create mutation isn't invalidating the "active org" query)
    // rather than a test timing issue - worth filing separately if it
    // recurs.
    await page.reload();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  }
  // Register for automatic cleanup (see support/fixtures.ts) so this
  // disposable org doesn't keep accumulating under the shared seed admin
  // for the rest of THIS run. The trigger has no "value" the way a <select>
  // did - the active-org cookie is the source of truth switchTo() itself
  // writes to (org-switcher.tsx), so read it back the same way the app does.
  const cookies = await page.context().cookies();
  const orgId = cookies.find((c) => c.name === ACTIVE_ORG_COOKIE)?.value;
  if (!orgId) throw new Error("createIsolatedOrg: active-org cookie was not set after creation.");
  trackOrgForCleanup(page, orgId);
}

/**
 * Navigates from wherever the (already-authenticated) page currently is to
 * the Team page (members + invitations) for whichever org is currently
 * active. Team is scoped to the active org rather than picked by name, so
 * `orgName` here only verifies we landed on the right one - the one
 * `createIsolatedOrg` just made active - not how we got there.
 */
export async function goToTeam(page: Page, orgName: string): Promise<void> {
  await clickNavLink(page, "Team", /\/team$/);
  await expect(page.getByRole("heading", { name: orgName })).toBeVisible();
}

/**
 * Creates a user's first organization from the zero-org empty state
 * (NoOrgState's "create one" button), reached when a brand-new user has no
 * orgs yet. Leaves the browser on whatever page the empty state was showing,
 * with CreateOrgDialog closed and the new org active.
 */
export async function createFirstOrgFromEmptyState(page: Page, orgName: string): Promise<void> {
  await page.getByRole("button", { name: "create one" }).click();
  await dialogFieldByLabel(page, "Name").fill(orgName);
  await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
