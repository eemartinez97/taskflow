import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { registerNewUser } from "./helpers/auth";
import { completeOnboarding, createIsolatedOrg, uniqueOrgName } from "./helpers/org";
import { createProject, navigateToProject, uniqueProjectName } from "./helpers/project";
import { createTaskInFirstColumn } from "./helpers/task";

test.describe("Onboarding gate", () => {
  // A brand-new, zero-org user is the ONLY scenario that genuinely needs
  // registration - every other test below reuses the pre-authenticated
  // seed session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a brand-new user with zero orgs reaches /onboarding via the empty state, then /projects", async ({
    page,
    registeredUser,
  }) => {
    await registerNewUser(page, registeredUser);
    await expect(page).toHaveURL(/\/projects/);
    await page.getByRole("link", { name: /or create one/i }).click();

    const org = uniqueOrgName("Onboarding Org");
    await completeOnboarding(page, org.name);
    await expect(page.getByText(/not part of any organization/i)).not.toBeVisible();
  });

  test("visiting /onboarding directly redirects to /projects once the user has an org", async ({
    page,
    registeredUser,
  }) => {
    await registerNewUser(page, registeredUser);
    await page.getByRole("link", { name: /or create one/i }).click();
    await completeOnboarding(page, uniqueOrgName().name);

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/projects/);
  });
});

test.describe("Project -> Board -> Task flow", () => {
  test("creates a project, a board column and a task, then edits it via the detail panel", async ({
    page,
  }: {
    page: Page;
  }) => {
    await createIsolatedOrg(page, uniqueOrgName("Board Flow Org").name);

    const project = uniqueProjectName("Website Revamp");
    await createProject(page, project);
    await navigateToProject(page, project.name);

    await page.getByRole("button", { name: "Add column" }).click();
    await page.getByLabel("New column name").fill("In Review");
    await page.getByRole("button", { name: "Confirm new column" }).click();
    await expect(page.getByText("In Review")).toBeVisible();

    await createTaskInFirstColumn(page, "Design landing page");

    await page.getByText("Design landing page").click();
    await expect(page.getByRole("dialog", { name: "Task details" })).toBeVisible();

    const taskPanel = page.getByRole("dialog", { name: "Task details" });
    await page.getByLabel("Description").fill("Use the new brand guidelines.");
    await page.getByLabel("Description").blur();
    // "Saved" exact + scoped to the panel: a page-wide /saved/i also matches
    // the mounted-but-closed "Unsaved changes" ConfirmDialog.
    await expect(taskPanel.getByText("Saved", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(taskPanel).not.toBeVisible();
  });
});
