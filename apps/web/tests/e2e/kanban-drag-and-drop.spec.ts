import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createIsolatedOrg, uniqueOrgName } from "./helpers/org";
import { createProject, navigateToProject, uniqueProjectName } from "./helpers/project";
import { createTaskInFirstColumn, dragCardBetweenColumns } from "./helpers/task";

async function setUpBoardWithColumn(page: Page, columnName: string): Promise<void> {
  await createIsolatedOrg(page, uniqueOrgName("Kanban Org").name);
  const project = uniqueProjectName("DnD Project");
  await createProject(page, project);
  await navigateToProject(page, project.name);

  await page.getByRole("button", { name: "Add column" }).click();
  const newColInput = page.getByLabel("New column name");
  await newColInput.fill(columnName);
  await page.getByRole("button", { name: "Confirm new column" }).click();
  await expect(page.getByText(columnName)).toBeVisible();
  await newColInput.press("Escape");
  await expect(newColInput).toBeHidden();
}

test.describe("Kanban board drag & drop", () => {
  test("moves a task between columns via pointer drag", async ({ page }) => {
    await setUpBoardWithColumn(page, "Doing");
    await createTaskInFirstColumn(page, "Movable task");

    await dragCardBetweenColumns(page, "Movable task", "Doing");

    const doingColumn = page.getByTestId(/column-/).filter({ hasText: "Doing" });
    await expect(doingColumn.getByText("Movable task")).toBeVisible({ timeout: 10_000 });
  });

  test("moves a task between columns via keyboard (accessible DnD)", async ({ page }) => {
    await setUpBoardWithColumn(page, "Doing");
    await createTaskInFirstColumn(page, "Keyboard task");

    const handle = page.getByRole("button", { name: /move task: keyboard task/i });
    // The new column is appended LAST; step right once per remaining column so
    // the test stays valid regardless of how many default columns exist.
    const columnCount = await page.getByTestId(/^column-/).count();
    await handle.focus();
    await page.keyboard.press("Space");
    // dnd-kit's KeyboardSensor animates each move via requestAnimationFrame;
    // rapid-fire presses get swallowed before the previous move settles.
    await page.waitForTimeout(300);
    for (let i = 0; i < columnCount - 1; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
    }
    await page.keyboard.press("Space");

    await page.waitForTimeout(300);

    const doingColumn = page.getByTestId(/column-/).filter({ hasText: "Doing" });
    await expect(doingColumn.getByText("Keyboard task")).toBeVisible({ timeout: 10_000 });
  });
});
