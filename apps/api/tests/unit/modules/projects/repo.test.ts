import { describe } from "vitest";

import {
  createProject,
  deleteProject,
  findProjectById,
  findProjectsByOrg,
  updateProject,
} from "../../../../src/modules/projects/repo";
import { buildProject } from "../../../factories";
import { db, VALID_ORG_ID, VALID_PROJECT_ID } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { itDelegatesToPrisma } from "../../../support/repo-contract";

const project = buildProject();

describe("projects repo", () => {
  itDelegatesToPrisma([
    {
      name: "findProjectsByOrg",
      delegate: mockDb.project.findMany,
      resolves: [project],
      call: () => findProjectsByOrg(db, VALID_ORG_ID),
      args: { where: { orgId: VALID_ORG_ID }, orderBy: { createdAt: "asc" } },
    },
    {
      name: "findProjectById",
      delegate: mockDb.project.findUnique,
      resolves: project,
      call: () => findProjectById(db, VALID_PROJECT_ID),
      args: { where: { id: VALID_PROJECT_ID } },
    },
    {
      name: "createProject injects orgId and strips undefined",
      delegate: mockDb.project.create,
      resolves: project,
      call: () =>
        createProject(db, VALID_ORG_ID, {
          name: "Web",
          slug: "web",
          key: "WEB",
          description: undefined,
        }),
      args: { data: { name: "Web", orgId: VALID_ORG_ID, slug: "web", key: "WEB" } },
    },
    {
      name: "updateProject",
      delegate: mockDb.project.update,
      resolves: project,
      call: () => updateProject(db, VALID_PROJECT_ID, { name: "Renamed" }),
      args: { where: { id: VALID_PROJECT_ID }, data: { name: "Renamed" } },
    },
    {
      name: "deleteProject",
      delegate: mockDb.project.delete,
      resolves: project,
      call: () => deleteProject(db, VALID_PROJECT_ID),
      args: { where: { id: VALID_PROJECT_ID } },
      returns: undefined,
    },
  ]);
});
