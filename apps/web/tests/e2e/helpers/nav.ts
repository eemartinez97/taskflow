import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Clicks a nav link and asserts the URL actually changed, RETRYING THE
 * CLICK ITSELF (not just the assertion) on failure.
 *
 * WHY: under real concurrency (fewer --workers / --repeat-each), a click
 * can land on a Next.js <Link> a split second before hydration attaches its
 * handlers, or right as a parent re-render (e.g. the org switcher settling
 * post-creation) replaces the nav's DOM node mid-event - the click gets
 * consumed but no navigation happens. A single click + a longer timeout
 * just waits out a navigation that will never occur; re-clicking recovers
 * because the SECOND click lands on an already-hydrated, stable node.
 */

export async function clickAndExpectUrl(link: Locator, urlPattern: RegExp): Promise<void> {
  await expect(async () => {
    await link.click();
    await expect(link.page()).toHaveURL(urlPattern, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

export async function clickNavLink(
  page: Page,
  name: string | RegExp,
  urlPattern: RegExp,
): Promise<void> {
  await clickAndExpectUrl(page.getByRole("link", { name }), urlPattern);
}
