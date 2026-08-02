import { describe, expect, it } from "vitest";
import { mockDb } from "../../../mocks/database-mock";
import { TENANCY_CASES } from "../../../support/tenancy-fixtures";

describe.each(TENANCY_CASES)("assert$name InOrg", ({ model, inOrg, foreign, call }) => {
  const delegate = mockDb[model];

  it("resolves when the resource lives in the org", async () => {
    delegate.findUnique.mockResolvedValueOnce(inOrg);
    await expect(call()).resolves.toBeUndefined();
  });

  it("throws NOT_FOUND for another org", async () => {
    delegate.findUnique.mockResolvedValueOnce(foreign);
    await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when the resource does not exist", async () => {
    delegate.findUnique.mockResolvedValueOnce(null);
    await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
