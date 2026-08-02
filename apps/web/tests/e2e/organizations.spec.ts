import { expect, test } from "./support/fixtures";
import { createIsolatedOrg, uniqueOrgName } from "./helpers/org";
import { dialogFieldByLabel } from "./helpers/field";

test.describe("Multi-organization flows", () => {
  test("user can create a new org via the sidebar switcher and it becomes active", async ({
    page,
  }) => {
    const org = uniqueOrgName("Switcher Org");
    await createIsolatedOrg(page, org.name);
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByLabel("Select organization")).toHaveValue(/.+/);
  });

  test("owner can edit and delete an organization from the Organizations page", async ({
    page,
  }) => {
    const org = uniqueOrgName("Editable Org");
    await createIsolatedOrg(page, org.name);
    await page.getByRole("link", { name: "Organizations" }).click();
    await page.getByRole("button", { name: new RegExp(`edit ${org.name}`, "i") }).click();

    const renamedName = `${org.name} Renamed`;
    const editDialog = page.getByRole("dialog");
    await dialogFieldByLabel(page, "Name").fill(renamedName);
    await editDialog.getByRole("button", { name: "Save", exact: true }).click();
    // Role-name matching is case-insensitive, so this passes even though the
    // server normalizes the stored name's casing (e.g. title-casing).
    const renamedHeading = page.getByRole("heading", { name: renamedName });
    await expect(renamedHeading).toBeVisible();
    // The delete guard compares against the SERVER-canonical name, which may
    // differ in casing from what we typed - read it back from the DOM.
    const canonicalName = (await renamedHeading.textContent()) ?? renamedName;

    await page.getByRole("button", { name: new RegExp(`delete ${canonicalName}`, "i") }).click();
    const deleteDialog = page.getByRole("dialog");
    await deleteDialog.getByLabel(/type/i).fill(canonicalName);
    await deleteDialog.getByRole("button", { name: "Yes, delete everything", exact: true }).click();
    await expect(renamedHeading).not.toBeVisible();
  });
});
