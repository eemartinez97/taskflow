import { describe, expect, it } from "vitest";
import { canAdminOrg, canMutateInOrg, isOrgOwner } from "@/lib/utils/role";
import type { Role } from "@taskflow/shared";

describe("canAdminOrg", () => {
  it.each<[Role, boolean]>([
    ["OWNER", true],
    ["ADMIN", true],
    ["MEMBER", false],
    ["VIEWER", false],
  ])("returns %s => %s", (role, expected) => {
    expect(canAdminOrg(role)).toBe(expected);
  });
});

describe("canMutateInOrg", () => {
  it.each<[Role, boolean]>([
    ["OWNER", true],
    ["ADMIN", true],
    ["MEMBER", true],
    ["VIEWER", false],
  ])("returns %s => %s", (role, expected) => {
    expect(canMutateInOrg(role)).toBe(expected);
  });
});

describe("isOrgOwner", () => {
  it("is true only for OWNER", () => {
    expect(isOrgOwner("OWNER")).toBe(true);
    expect(isOrgOwner("ADMIN")).toBe(false);
  });
});
