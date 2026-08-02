import { expect, type Page } from "@playwright/test";

/**
 * E2E helpers for task interactions on the Kanban board.
 *
 * dnd-kit uses pointer events - Playwright's `dragTo` is DOM-native and does
 * not trigger dnd-kit's sensors, so we simulate the gesture via raw mouse
 * events instead.
 */

export async function dragCardBetweenColumns(
  page: Page,
  cardTitle: string,
  targetColumnName: string,
): Promise<void> {
  const handle = page.getByRole("button", { name: `Move task: ${cardTitle}` });

  const dropZone = page
    .getByTestId(/^column-/)
    .filter({ has: page.getByText(targetColumnName, { exact: true }) })
    .locator("[data-column-scroll]");

  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error(`Drag handle for card "${cardTitle}" not found`);

  const srcX = handleBox.x + handleBox.width / 2;
  const srcY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(srcX, srcY);
  await page.mouse.down();

  await page.mouse.move(srcX + 10, srcY + 10, { steps: 5 });
  await page.waitForTimeout(200);

  let colBox = await dropZone.boundingBox();
  if (!colBox) throw new Error(`Drop zone for column "${targetColumnName}" not found`);

  const viewport = page.viewportSize();
  if (viewport) {
    const targetCenterX = colBox.x + colBox.width / 2;
    const isOffScreenRight = targetCenterX > viewport.width;
    const isOffScreenLeft = colBox.x < 0;

    if (isOffScreenRight || isOffScreenLeft) {
      const board = page.getByTestId("kanban-board");
      const boardBox = await board.boundingBox();
      if (!boardBox) throw new Error("Board not found");

      const edgeX = isOffScreenRight
        ? Math.min(boardBox.x + boardBox.width - 30, viewport.width - 30)
        : Math.max(boardBox.x + 30, 30);

      await page.mouse.move(edgeX, srcY, { steps: 10 });

      const dropZoneHandle = await dropZone.elementHandle();
      if (dropZoneHandle) {
        await page
          .waitForFunction(
            (el) => {
              const rect = el.getBoundingClientRect();
              return rect.x >= 0 && rect.x + rect.width <= window.innerWidth;
            },
            dropZoneHandle,
            { timeout: 5000 },
          )
          .catch(() => {
            //
          });
      }

      colBox = await dropZone.boundingBox();
      if (!colBox) throw new Error(`Drop zone for column "${targetColumnName}" disappeared`);
    }
  }

  const dstX = colBox.x + colBox.width / 2;
  const dstY = srcY + 20;

  await page.mouse.move(dstX, dstY, { steps: 15 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/**
 * Creates a task through the first column's inline composer and waits for the
 * card to render. `exact: true` is required on the confirm button: role-name
 * matching is substring-based, so plain "Add" also matches the "Add task" and
 * "Add column" buttons (strict mode violation).
 */
export async function createTaskInFirstColumn(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Add task" }).first().click();
  const composer = page.getByPlaceholder("Task title");
  await composer.fill(title);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(title)).toBeVisible();
  // The composer stays open + focused by design (lets users add several tasks
  // in a row). Close it so the board is idle before any drag: otherwise the
  // pointerdown/focus that starts a drag blurs this input, which unmounts the
  // composer mid-gesture, tears down the column subtree, and makes dnd-kit lose
  // pointer capture -> the drag silently aborts.
  await composer.press("Escape");
  await expect(composer).toBeHidden();
}
