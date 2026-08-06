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
    const doingColumn = page.getByTestId(/^column-/).filter({ hasText: "Doing" });
    const taskInDoing = doingColumn.getByText("Keyboard task");

    // Generous upper bound on ArrowRight presses - NOT a 1:1 count of
    // columns. Confirmed via instrumented dragOver logging (see git
    // history): each press fires two dragOver events - the sensor's actual
    // move, then a "bounce back to self" once onDragOver optimistically
    // re-anchors the active card inside its new column (see
    // useBoardDnD.onDragOver). In Firefox specifically, the coordinate
    // recalculation FROM that new anchor point occasionally lands on the
    // exact same target as before, so dnd-kit fires no dragOver at all for
    // that press (it only fires on `over` change) - silently wasting one
    // press. Chromium never exhibited this; a 1:1 budget therefore
    // deterministically undershoots by one column in Firefox. Polling with
    // real headroom (well beyond the column count) absorbs however many
    // presses get silently swallowed, while still being tightly bounded.
    const columnCount = await page.getByTestId(/^column-/).count();
    const maxSteps = columnCount * 3;
    await handle.focus();
    await page.keyboard.press("Space");
    // dnd-kit's KeyboardSensor animates each move via requestAnimationFrame;
    // rapid-fire presses can get swallowed before the previous move settles.
    // Polling the actual DOM after each press instead of blindly counting
    // presses is robust to per-run timing jitter: onDragOver already
    // optimistically moves the card into the hovered column (see
    // useBoardDnD.onDragOver) well before Space commits the drop, so we can
    // observe the real state instead of guessing it.
    await page.waitForTimeout(300);
    for (let i = 0; i < maxSteps; i++) {
      if (await taskInDoing.isVisible()) break;
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
    }
    await expect(taskInDoing).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    await expect(doingColumn.getByText("Keyboard task")).toBeVisible({ timeout: 10_000 });
  });
});
