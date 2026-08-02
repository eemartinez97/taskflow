import { chromium, type FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { SEED_USER } from "./support/seed-user";
import { fieldByLabel } from "./helpers/field";

const AUTH_FILE = path.join(process.cwd(), "playwright/.auth/user.json");

async function globalSetup(_config: FullConfig): Promise<void> {
  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000/login");
    await page.getByLabel(/^email/i).fill(SEED_USER.email);
    await page.getByLabel(/^password/i).fill(SEED_USER.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/(onboarding|projects)/, { timeout: 15_000 });

    // Fails loudly instead of silently producing a blank/broken authenticated
    // session if the post-login page crashed server-side (e.g. a data bug
    // like invalid seeded UUIDs) - catches regressions immediately instead
    // of surfacing as a confusing "file not found" 10 minutes later.
    const heading = page.getByRole("heading").first();
    await heading.waitFor({ state: "visible", timeout: 10_000 });

    if (page.url().includes("/onboarding")) {
      await fieldByLabel(page, "Name").fill("Playwright Seed Org");
      await page.getByRole("button", { name: "Create Organization" }).click();
      await page.waitForURL(/\/projects/, { timeout: 15_000 });
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
