import type { Page, Locator } from "@playwright/test";

/**
 * Locates a form field by its associated <label> text, tolerating the
 * optional trailing required-field asterisk our design system renders.
 * See `dialogFieldByLabel` for why plain page-wide lookups are unsafe.
 */
function labelPattern(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}\\*?$`);
}

/**
 * Use for fields on plain pages with no dialog on screen (e.g. /settings'
 * ProfileForm, /login, /register). Safe ONLY when no closed-but-mounted
 * dialog with a same-labeled field exists elsewhere on that page.
 */
export function fieldByLabel(page: Page, label: string): Locator {
  return page.getByLabel(labelPattern(label));
}

/**
 * Use for fields INSIDE an open dialog (CreateOrgDialog, CreateProjectDialog,
 * EditOrgDialog, InviteDialog, etc).
 *
 * WHY this is required and `fieldByLabel` is not enough: the real @taskflow/ui
 * `<Dialog>` keeps its content mounted in the DOM even while closed (a native
 * `<dialog>` element without the `open` attribute is simply not painted, not
 * removed). `getByLabel()` matches DOM label associations directly and does
 * NOT consult the accessibility tree, so it still "sees" fields inside every
 * closed dialog on the page (e.g. ProjectList always mounts
 * <CreateProjectDialog>, whose Name field collides with any other dialog's
 * Name field). `getByRole("dialog")` DOES use the accessibility tree, which
 * correctly excludes non-rendered (closed) dialogs - scoping to it resolves
 * the ambiguity deterministically regardless of how many dialogs exist on
 * the page.
 */
export function dialogFieldByLabel(page: Page, label: string): Locator {
  return page.getByRole("dialog").getByLabel(labelPattern(label));
}
