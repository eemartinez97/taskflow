import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { registerNewUser } from "./helpers/auth";
import { createFirstOrgFromEmptyState, createIsolatedOrg, uniqueOrgName } from "./helpers/org";
import { createProject, navigateToProject, uniqueProjectName } from "./helpers/project";
import { createTaskInFirstColumn } from "./helpers/task";

test.describe("First organization via the empty state", () => {
  // A brand-new, zero-org user is the ONLY scenario that genuinely needs
  // registration - every other test below reuses the pre-authenticated
  // seed session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a brand-new user with zero orgs creates their first org from the /projects empty state", async ({
    page,
    registeredUser,
  }) => {
    await registerNewUser(page, registeredUser);
    await expect(page).toHaveURL(/\/projects/);
    // .first(): under real concurrency, a just-completed client-side
    // navigation can briefly leave a second, inert copy of this heading in
    // the DOM (not exposed via the accessibility tree, but still matched by
    // getByText) while the transition settles - the assertion only cares
    // that the empty state is showing, not how many copies exist.
    const emptyStateHeading = page.getByText(/not part of any organization/i).first();
    await expect(emptyStateHeading).toBeVisible();

    const org = uniqueOrgName("Empty State Org");
    await createFirstOrgFromEmptyState(page, org.name);

    // The empty state only disappears once /projects re-fetches org data
    // post-creation (router.refresh()); under load that refetch can lag
    // behind the dialog closing, so give it real time before failing.
    await expect(emptyStateHeading).not.toBeVisible({ timeout: 15_000 });
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
    // Not getByText("In Review"): every column's status-mapping <select>
    // (kanban-column.tsx) renders an "IN REVIEW" <option>, and getByText's
    // substring/case-insensitive match hits those too - scope to the
    // column-name button, whose aria-label is unique per column.
    await expect(page.getByRole("button", { name: "Edit column name (In Review)" })).toBeVisible();

    await createTaskInFirstColumn(page, "Design landing page");

    await page.getByText("Design landing page").click();
    await expect(page.getByRole("dialog", { name: "Task details" })).toBeVisible();

    const taskPanel = page.getByRole("dialog", { name: "Task details" });
    // Scoped to taskPanel: the /projects page's CreateProjectDialog also has
    // a "Description" field and Next.js keeps that route segment mounted in
    // its client-side router cache, so an unscoped getByLabel matches both.
    await taskPanel.getByLabel("Description").fill("Use the new brand guidelines.");
    await taskPanel.getByLabel("Description").blur();
    // "Saved" exact + scoped to the panel: a page-wide /saved/i also matches
    // the mounted-but-closed "Unsaved changes" ConfirmDialog.
    await expect(taskPanel.getByText("Saved", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(taskPanel).not.toBeVisible();
  });
});
