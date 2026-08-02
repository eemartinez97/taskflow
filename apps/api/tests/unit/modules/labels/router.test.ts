import { beforeEach, describe, expect, it, vi } from "vitest";

import { labelsRouter } from "../../../../src/modules/labels/router";
import * as service from "../../../../src/modules/labels/service";
import { db, VALID_LABEL_ID, VALID_ORG_ID } from "../../../helpers";
import { callerFor, expectTRPCError, grantRole } from "../../../support/trpc";
import { mockDb } from "../../../mocks/database-mock";
import { TENANT } from "../../../support/tenancy-fixtures";

vi.mock("../../../../src/modules/labels/service");

const caller = () => callerFor(labelsRouter);

describe("labels router", () => {
  beforeEach(() => {
    grantRole("ADMIN");
    mockDb.label.findUnique.mockResolvedValue(TENANT.label); // delete
  });

  it("list -> listLabels", async () => {
    await caller().list({ orgId: VALID_ORG_ID });

    expect(service.listLabels).toHaveBeenCalledWith(db, VALID_ORG_ID);
  });

  it("create -> createLabelInOrg", async () => {
    const data = { name: "bug", color: "#EF4444" };

    await caller().create({ orgId: VALID_ORG_ID, data });

    expect(service.createLabelInOrg).toHaveBeenCalledWith(db, VALID_ORG_ID, data);
  });

  it("delete -> deleteLabelById", async () => {
    await caller().delete({ orgId: VALID_ORG_ID, labelId: VALID_LABEL_ID });

    expect(service.deleteLabelById).toHaveBeenCalledWith(db, VALID_LABEL_ID);
  });

  it.each([
    ["create", () => caller().create({ orgId: VALID_ORG_ID, data: { name: "b", color: "#fff" } })],
    ["delete", () => caller().delete({ orgId: VALID_ORG_ID, labelId: VALID_LABEL_ID })],
  ])("%s is admin-only", async (_name, call) => {
    grantRole("MEMBER");

    await expectTRPCError(call(), "FORBIDDEN");
  });

  it("list is open to MEMBER", async () => {
    grantRole("MEMBER");

    await expect(caller().list({ orgId: VALID_ORG_ID })).resolves.toBeUndefined();
  });
});
