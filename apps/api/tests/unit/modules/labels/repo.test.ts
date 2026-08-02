import { describe } from "vitest";

import {
  createLabel,
  deleteLabel,
  findLabelById,
  findLabelsByOrg,
} from "../../../../src/modules/labels/repo";
import { buildLabel } from "../../../factories";
import { db, VALID_LABEL_ID, VALID_ORG_ID } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { itDelegatesToPrisma } from "../../../support/repo-contract";

const label = buildLabel();

describe("labels repo", () => {
  itDelegatesToPrisma([
    {
      name: "findLabelsByOrg is alphabetical",
      delegate: mockDb.label.findMany,
      resolves: [label],
      call: () => findLabelsByOrg(db, VALID_ORG_ID),
      args: { where: { orgId: VALID_ORG_ID }, orderBy: { name: "asc" } },
    },
    {
      name: "findLabelById",
      delegate: mockDb.label.findUnique,
      resolves: label,
      call: () => findLabelById(db, VALID_LABEL_ID),
      args: { where: { id: VALID_LABEL_ID } },
    },
    {
      name: "createLabel injects orgId",
      delegate: mockDb.label.create,
      resolves: label,
      call: () => createLabel(db, VALID_ORG_ID, { name: "bug", color: "#EF4444" }),
      args: { data: { name: "bug", color: "#EF4444", orgId: VALID_ORG_ID } },
    },
    {
      name: "deleteLabel",
      delegate: mockDb.label.delete,
      resolves: label,
      call: () => deleteLabel(db, VALID_LABEL_ID),
      args: { where: { id: VALID_LABEL_ID } },
      returns: undefined,
    },
  ]);
});
