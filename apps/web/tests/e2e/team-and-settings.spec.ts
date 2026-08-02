import { expect, test } from "./support/fixtures";
import { createIsolatedOrg, uniqueOrgName } from "./helpers/org";
import { dialogFieldByLabel } from "./helpers/field";
import { registerUserViaApi } from "./helpers/auth";

test.describe("Team management and settings", () => {
  test("owner can open the invite dialog and send an invite", async ({ page, registeredUser }) => {
    await createIsolatedOrg(page, uniqueOrgName("Team Org").name);
    // The invite target must be an existing account, otherwise the mutation
    // fails with an inline error and the success toast never renders.
    await registerUserViaApi(page, registeredUser);
    await page.getByRole("link", { name: "Team" }).click();
    await expect(page).toHaveURL(/\/team/);
    await page.getByRole("button", { name: "Invite member" }).click();

    const dialog = page.getByRole("dialog");
    await dialogFieldByLabel(page, "Email").fill(registeredUser.email);
    await dialog.getByRole("button", { name: "Send invite", exact: true }).click();
    await expect(page.getByText(/invitation sent/i)).toBeVisible();
  });

  test("user can update their profile name", async ({ page }) => {
    await page.goto("/settings");
    const newName = `Updated Name ${Date.now().toString()}`;
    await page.locator("#profile-name").fill(newName);
    await page.getByRole("button", { name: "Save profile" }).click();
    // Assert the SERVER confirmed the save, not just that the input echoes
    // what we typed (which is trivially true and hides a hanging mutation).
    await expect(page.getByText("Profile updated.")).toBeVisible();
  });

  test("toggles the cursor preference", async ({ page }) => {
    await page.goto("/settings");
    const toggle = page.getByRole("button", { name: /hidden|visible/i });
    const before = await toggle.textContent();
    await toggle.click();
    await expect(toggle).not.toHaveText(before ?? "");
  });

  test("creates a label and deletes it with confirmation", async ({ page }) => {
    await createIsolatedOrg(page, uniqueOrgName("Label Org").name);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByPlaceholder("e.g. Bug").fill("Urgent");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Urgent", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /delete label urgent/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete label", exact: true })
      .click();
    // The closed ConfirmDialog stays mounted with "Urgent" in its description;
    // exact matching excludes it and targets only the label chip.
    await expect(page.getByText("Urgent", { exact: true })).not.toBeVisible();
  });
});
