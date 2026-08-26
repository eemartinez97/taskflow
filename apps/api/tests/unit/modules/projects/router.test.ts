import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectsRouter } from "../../../../src/modules/projects/router";
import * as service from "../../../../src/modules/projects/service";
import { db, VALID_ORG_ID, VALID_PROJECT_ID } from "../../../helpers";
import { callerFor, expectTRPCError, grantRole } from "../../../support/trpc";
import { mockDb } from "../../../mocks/database-mock";
import { TENANT } from "../../../support/tenancy-fixtures";

vi.mock("../../../../src/modules/projects/service");

const caller = () => callerFor(projectsRouter);

describe("projects router", () => {
  beforeEach(() => {
    grantRole("ADMIN");
    // Satisfy assertProjectInOrg for every procedure that includes projectId
    mockDb.project.findUnique.mockResolvedValue(TENANT.project);
  });

  it("list -> listProjects", async () => {
    await caller().list({ orgId: VALID_ORG_ID });

    expect(service.listProjects).toHaveBeenCalledWith(db, VALID_ORG_ID);
  });

  it("get -> getProject", async () => {
    await caller().get({ orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID });

    expect(service.getProject).toHaveBeenCalledWith(db, VALID_PROJECT_ID);
  });

  it("create -> createProjectInOrg", async () => {
    const data = { name: "Web", key: "WEB", slug: "web" };
    await caller().create({ orgId: VALID_ORG_ID, data });
    expect(service.createProjectInOrg).toHaveBeenCalledWith(db, VALID_ORG_ID, data);
  });

  it("update -> updateProjectById", async () => {
    await caller().update({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      data: { name: "Renamed" },
    });

    expect(service.updateProjectById).toHaveBeenCalledWith(db, VALID_PROJECT_ID, {
      name: "Renamed",
    });
  });

  it("delete -> deleteProjectById", async () => {
    await caller().delete({ orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID });

    expect(service.deleteProjectById).toHaveBeenCalledWith(db, VALID_PROJECT_ID);
  });

  it.each([
    [
      "update",
      () =>
        caller().update({ orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID, data: { name: "x" } }),
    ],
    ["delete", () => caller().delete({ orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID })],
  ])("%s requires OWNER or ADMIN", async (_name, call) => {
    grantRole("MEMBER");

    await expectTRPCError(call(), "FORBIDDEN");
  });

  it("allows a VIEWER to list projects (read-only)", async () => {
    grantRole("VIEWER");

    await caller().list({ orgId: VALID_ORG_ID });
    expect(service.listProjects).toHaveBeenCalledWith(db, VALID_ORG_ID);
  });

  it("rejects a VIEWER from creating a project (write)", async () => {
    grantRole("VIEWER");
    const data = { name: "Web", key: "WEB", slug: "web" };

    await expectTRPCError(caller().create({ orgId: VALID_ORG_ID, data }), "FORBIDDEN");
  });
});
