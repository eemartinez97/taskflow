import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { takeTrackedOrgs } from "../helpers/org-cleanup";

interface AuthFixtures {
  registeredUser: { email: string; password: string; name: string };
}

/** Generates a unique test user per test run to avoid collisions in a shared DB. */
export const test = base.extend<AuthFixtures>({
  // eslint-disable-next-line no-empty-pattern
  registeredUser: async ({}, use) => {
    const uniqueId = randomUUID().slice(0, 8);
    await use({
      email: `e2e-${uniqueId}@taskflow.dev`,
      password: "Str0ng!Passw0rd",
      name: `E2E User ${uniqueId}`,
    });
  },
  page: async ({ page }, use) => {
    await use(page);
    // Runs after every test regardless of pass/fail. Deletes any org
    // created via createIsolatedOrg so a single run's total org count under
    // the shared seed admin stays bounded by "tests currently in flight"
    // rather than "total tests executed so far" - see
    // apps/web/app/api/test/delete-org/route.ts.
    const orgIds = takeTrackedOrgs(page);
    for (const orgId of orgIds) {
      await page.request
        .post("/api/test/delete-org", {
          data: { orgId },
          headers: { "x-e2e-secret": process.env.E2E_TEST_SECRET ?? "" },
        })
        .catch(() => {
          // Best-effort: don't fail an otherwise-passing test over cleanup.
        });
    }
  },
});

export { expect };
