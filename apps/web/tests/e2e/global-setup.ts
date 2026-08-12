import { chromium, type FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { SEED_USER } from "./support/seed-user";
import { dialogFieldByLabel } from "./helpers/field";

const AUTH_FILE = path.join(process.cwd(), "playwright/.auth/user.json");

/**
 * Wipes every non-seed Org/User before the run starts (see
 * apps/api/src/routes/test.ts for the full rationale - the auth-
 * consolidation epic moved every /api/test/* backdoor route there
 * alongside the mail sender it reads from; apps/web has no rewrite
 * proxying this prefix back to it, so this must hit apps/api directly).
 * Runs ONCE per `playwright test` invocation, before the shared
 * storageState is captured, so every run starts from the exact same DB
 * state regardless of how many orgs previous runs left behind.
 */
async function resetE2EData(): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const response = await fetch(`${apiUrl}/api/test/reset`, {
    method: "POST",
    headers: { "x-e2e-secret": process.env.E2E_TEST_SECRET ?? "" },
  });
  if (!response.ok) {
    throw new Error(
      `[global-setup] Failed to reset E2E data: HTTP ${String(response.status)}. ` +
        "Ensure ENABLE_TEST_ROUTES=true is set for the web dev server.",
    );
  }
}

async function globalSetup(_config: FullConfig): Promise<void> {
  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await resetE2EData();
    await page.goto("http://localhost:3000/login");
    await page.getByLabel(/^email/i).fill(SEED_USER.email);
    await page.getByLabel(/^password/i).fill(SEED_USER.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/projects/, { timeout: 15_000 });

    // Fails loudly instead of silently producing a blank/broken authenticated
    // session if the post-login page crashed server-side (e.g. a data bug
    // like invalid seeded UUIDs) - catches regressions immediately instead
    // of surfacing as a confusing "file not found" 10 minutes later.
    const heading = page.getByRole("heading").first();
    await heading.waitFor({ state: "visible", timeout: 10_000 });

    const createOneButton = page.getByRole("button", { name: "create one" });
    if (await createOneButton.isVisible().catch(() => false)) {
      await createOneButton.click();
      await dialogFieldByLabel(page, "Name").fill("Playwright Seed Org");
      await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15_000 });
    }

    await context.storageState({ path: AUTH_FILE });
  } catch (error) {
    console.error("[global-setup] Failed to authenticate the seed user.");
    console.error("[global-setup] Verify: seed data is valid, apps/api is healthy, and");
    console.error(
      "[global-setup] the seeded admin credentials match packages/database/prisma/seed.ts.",
    );
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
