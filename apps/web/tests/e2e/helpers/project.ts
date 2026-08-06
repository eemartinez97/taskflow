import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { dialogFieldByLabel } from "./field";
import { clickAndExpectUrl } from "./nav";

/** E2E helpers for project-related actions. */
export function uniqueProjectName(prefix = "Test Project"): {
  name: string;
  key: string;
  slug: string;
} {
  const id = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return {
    name: `${prefix} ${id}`,
    key: `TP${id.slice(0, 4)}`,
    slug: `${prefix.toLowerCase().replace(/\s+/g, "-")}-${id.toLowerCase()}`,
  };
}

export async function createProject(
  page: Page,
  project: { name: string; key: string; slug: string },
): Promise<void> {
  await page.getByRole("button", { name: /new project/i }).click();
  const dialog = page.getByRole("dialog");
  await dialogFieldByLabel(page, "Name").fill(project.name);
  await dialogFieldByLabel(page, "Key").fill(project.key);
  await dialogFieldByLabel(page, "Slug").fill(project.slug);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText(project.name)).toBeVisible({ timeout: 10_000 });
}

export async function navigateToProject(page: Page, projectName: string): Promise<void> {
  await clickAndExpectUrl(page.getByText(projectName), /\/projects\//);
}
