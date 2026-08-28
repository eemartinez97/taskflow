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
  // Scoped to the "Projects list" <ul> (project-list.tsx), not a page-wide
  // getByText: mid-navigation, Next.js can briefly keep the OLD /projects
  // list mounted (with the project's card title) at the same instant the
  // NEW project page has already rendered its own heading with the same
  // name - an unscoped locator matches both and clickAndExpectUrl's retry
  // hits it as a strict-mode violation, not a soft timeout.
  await clickAndExpectUrl(page.getByLabel("Projects list").getByText(projectName), /\/projects\//);
}
