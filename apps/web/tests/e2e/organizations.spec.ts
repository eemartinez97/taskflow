import { expect, test } from "./support/fixtures";
import { createIsolatedOrg, uniqueOrgName } from "./helpers/org";
import { clickNavLink } from "./helpers/nav";

test.describe("Multi-organization flows", () => {
  test("user can create a new org via the sidebar switcher and it becomes active", async ({
    page,
  }) => {
    const org = uniqueOrgName("Switcher Org");
    await createIsolatedOrg(page, org.name);
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByLabel("Select organization")).toHaveValue(/.+/);
  });

  test("owner can rename and delete an organization from Settings", async ({ page }) => {
    const org = uniqueOrgName("Editable Org");
    await createIsolatedOrg(page, org.name);
    await clickNavLink(page, "Settings", /\/settings/);

    // Scoped by id, not label text: Settings also has a Profile "Name"
    // field, so the accessible name "Name" alone is ambiguous.
    const renamedName = `${org.name} Renamed`;
    await page.locator("#org-name").fill(renamedName);
    await page.getByRole("button", { name: "Save organization", exact: true }).click();
    await expect(page.getByText("Organization updated.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Delete organization", exact: true }).click();
    const deleteDialog = page.getByRole("dialog");
    await deleteDialog.getByLabel(/type/i).fill(renamedName);
    await deleteDialog.getByRole("button", { name: "Yes, delete everything", exact: true }).click();
    await expect(page.getByText("Organization deleted.")).toBeVisible({ timeout: 15_000 });
    await expect(deleteDialog).toBeHidden();
    // Self-heals to a different active org (see organization-section.tsx) - the
    // deleted (globally-unique) org name shouldn't remain selectable. Scoped
    // to the switcher specifically: the same text also transiently matches
    // the (now-hidden) confirm dialog's own description/label elements.
    await expect(page.getByLabel("Select organization")).not.toContainText(renamedName);
  });
});
