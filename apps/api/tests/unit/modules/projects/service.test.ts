import { describe, expect, it } from "vitest";

import {
  createProjectInOrg,
  deleteProjectById,
  getProject,
  listProjects,
  updateProjectById,
} from "../../../../src/modules/projects/service";
import { buildBoard, buildProject } from "../../../factories";
import { db, VALID_ORG_ID, VALID_PROJECT_ID } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";

const project = buildProject();

describe("projects service", () => {
  it("listProjects returns the org's projects", async () => {
    mockDb.project.findMany.mockResolvedValueOnce([project]);

    await expect(listProjects(db, VALID_ORG_ID)).resolves.toEqual([project]);
  });

  it("getProject returns the project", async () => {
    mockDb.project.findUnique.mockResolvedValueOnce(project);

    await expect(getProject(db, VALID_PROJECT_ID)).resolves.toBe(project);
  });

  it.each([
    ["getProject", () => getProject(db, VALID_PROJECT_ID)],
    ["updateProjectById", () => updateProjectById(db, VALID_PROJECT_ID, { name: "x" })],
    ["deleteProjectById", () => deleteProjectById(db, VALID_PROJECT_ID)],
  ])("%s throws NOT_FOUND for a missing project", async (_name, call) => {
    mockDb.project.findUnique.mockResolvedValueOnce(null);

    await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("createProjectInOrg seeds a default board so the page is never empty", async () => {
    mockDb.project.create.mockResolvedValueOnce(project);
    mockDb.board.create.mockResolvedValueOnce(buildBoard());

    await expect(
      createProjectInOrg(db, VALID_ORG_ID, { name: "Web", key: "WEB", slug: "web" }),
    ).resolves.toBe(project);

    expect(mockDb.board.create).toHaveBeenCalledWith({
      data: { projectId: VALID_PROJECT_ID, name: "Main Board" },
    });
    expect(mockDb.column.create).toHaveBeenCalledTimes(4);
  });

  it("updateProjectById updates an existing project", async () => {
    mockDb.project.findUnique.mockResolvedValueOnce(project);
    mockDb.project.update.mockResolvedValueOnce({ ...project, name: "Renamed" });

    await expect(
      updateProjectById(db, VALID_PROJECT_ID, { name: "Renamed" }),
    ).resolves.toMatchObject({ name: "Renamed" });
  });

  it("deleteProjectById reports success", async () => {
    mockDb.project.findUnique.mockResolvedValueOnce(project);

    await expect(deleteProjectById(db, VALID_PROJECT_ID)).resolves.toEqual({ success: true });
  });
});
