import type { Page } from "@playwright/test";

/**
 * Tracks org IDs created via createIsolatedOrg, keyed by Page, so the
 * `page` fixture teardown (see support/fixtures.ts) can delete them after
 * each test finishes - pass or fail. A WeakMap keyed by Page avoids
 * augmenting Playwright's Page type or threading an extra param through
 * every createIsolatedOrg call site.
 */
const pendingCleanup = new WeakMap<Page, string[]>();

export function trackOrgForCleanup(page: Page, orgId: string): void {
  const list = pendingCleanup.get(page) ?? [];
  list.push(orgId);
  pendingCleanup.set(page, list);
}

export function takeTrackedOrgs(page: Page): string[] {
  const list = pendingCleanup.get(page) ?? [];
  pendingCleanup.delete(page);
  return list;
}
