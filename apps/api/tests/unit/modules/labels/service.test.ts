import { describe, expect, it } from "vitest";

import {
  createLabelInOrg,
  deleteLabelById,
  listLabels,
} from "../../../../src/modules/labels/service";
import { buildLabel } from "../../../factories";
import { db, VALID_LABEL_ID, VALID_ORG_ID } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";

const label = buildLabel();

describe("labels service", () => {
  it("listLabels returns the org's labels", async () => {
    mockDb.label.findMany.mockResolvedValueOnce([label]);

    await expect(listLabels(db, VALID_ORG_ID)).resolves.toEqual([label]);
  });

  it("createLabelInOrg delegates to the repo", async () => {
    mockDb.label.create.mockResolvedValueOnce(label);

    await expect(
      createLabelInOrg(db, VALID_ORG_ID, { name: "bug", color: "#EF4444" }),
    ).resolves.toBe(label);
  });

  it("deleteLabelById reports success", async () => {
    mockDb.label.findUnique.mockResolvedValueOnce(label);

    await expect(deleteLabelById(db, VALID_LABEL_ID)).resolves.toEqual({ success: true });
    expect(mockDb.label.delete).toHaveBeenCalledWith({ where: { id: VALID_LABEL_ID } });
  });

  it("throws NOT_FOUND for a label that does not exist", async () => {
    mockDb.label.findUnique.mockResolvedValueOnce(null);

    await expect(deleteLabelById(db, VALID_LABEL_ID)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.label.delete).not.toHaveBeenCalled();
  });
});
