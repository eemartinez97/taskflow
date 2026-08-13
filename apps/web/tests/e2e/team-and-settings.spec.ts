import { expect, test } from "./support/fixtures";
import { createIsolatedOrg, goToTeam, uniqueOrgName } from "./helpers/org";
import { dialogFieldByLabel } from "./helpers/field";
import { registerUserViaApi } from "./helpers/auth";
import { clickNavLink } from "./helpers/nav";

test.describe("Team management and settings", () => {
  test("owner can open the invite dialog and send an invite", async ({ page, registeredUser }) => {
    const org = uniqueOrgName("Team Org");
    await createIsolatedOrg(page, org.name);
    // The invite target must be an existing account, otherwise the mutation
    // fails with an inline error and the success toast never renders.
    await registerUserViaApi(page, registeredUser);
    await goToTeam(page, org.name);
    await page.getByRole("button", { name: "Invite member" }).click();

    const dialog = page.getByRole("dialog");
    await dialogFieldByLabel(page, "Email").fill(registeredUser.email);
    await dialog.getByRole("button", { name: "Send invite", exact: true }).click();
    // Exact match: a loose /invitation sent/i also matches the (still-
    // mounted-but-closed) revoke ConfirmDialog's "Revoke the invitation
    // sent to X?" description elsewhere on the org detail page.
    await expect(page.getByText("Invitation sent.", { exact: true })).toBeVisible();
  });

  test("user can update their profile name", async ({ page }) => {
    await page.goto("/projects");
    await clickNavLink(page, "Settings", /\/settings/);
    const newName = `Updated Name ${Date.now().toString()}`;
    await page.getByRole("textbox", { name: /name/i }).first().fill(newName);
    await page.getByRole("button", { name: "Save profile" }).click();
    // Assert the SERVER confirmed the save, not just that the input echoes
    // what we typed (which is trivially true and hides a hanging mutation).
    await expect(page.getByText("Profile updated.")).toBeVisible();
  });

  test("toggles the cursor preference", async ({ page }) => {
    await page.goto("/projects");
    await clickNavLink(page, "Settings", /\/settings/);
    await clickNavLink(page, "Preferences", /\/settings\/preferences/);
    const toggle = page.getByRole("button", { name: /hidden|visible/i });
    const before = await toggle.textContent();
    await toggle.click();
    await expect(toggle).not.toHaveText(before ?? "");
  });

  test("creates a label and deletes it with confirmation", async ({ page }) => {
    await createIsolatedOrg(page, uniqueOrgName("Label Org").name);
    await clickNavLink(page, "Settings", /\/settings/);
    await clickNavLink(page, "Labels", /\/settings\/labels/);
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
