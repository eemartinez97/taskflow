import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/env.js");

import { createCallerFactory, createTRPCRouter } from "../../../src/trpc/init.js";
import { projectsRouter } from "../../../src/modules/projects/router.js";
import {
  ANOTHER_UUID,
  getMockArg,
  makeCtx,
  VALID_ORG_ID,
  VALID_USER,
  VALID_UUID,
} from "../../helpers.js";
import { mockDb } from "../../mocks/database-mock.js";

const caller = createCallerFactory(createTRPCRouter({ projects: projectsRouter }));
const authed = () => caller(makeCtx(VALID_USER));
const FIXED_DATE = new Date("2026-06-06T00:00:00.000Z");

const mockProject = {
  id: VALID_UUID,
  orgId: VALID_ORG_ID,
  name: "Demo Project",
  key: "DEMO",
  slug: "demo-project",
  description: "A demo project",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

describe("projects.list", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns projects for the org", async () => {
    mockDb.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
    mockDb.project.findMany.mockResolvedValue([mockProject]);
    const result = await authed().projects.list({ orgId: VALID_ORG_ID });
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe("DEMO");
  });

  it("throws FORBIDDEN when role is VIEWER", async () => {
    mockDb.membership.findUnique.mockResolvedValue({ role: "VIEWER" });
    await expect(authed().projects.list({ orgId: VALID_ORG_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("projects.get", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns a project by id", async () => {
    mockDb.project.findUnique.mockResolvedValue(mockProject);
    const result = await authed().projects.get({ projectId: VALID_UUID });
    expect(result.key).toBe("DEMO");
  });

  it("throws NOT_FOUND when project does not exist", async () => {
    mockDb.project.findUnique.mockResolvedValue(null);
    await expect(authed().projects.get({ projectId: ANOTHER_UUID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("projects.create", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a project and returns it", async () => {
    mockDb.membership.findUnique.mockResolvedValue({ role: "MEMBER" });
    mockDb.project.create.mockResolvedValue(mockProject);

    const result = await authed().projects.create({
      orgId: VALID_ORG_ID,
      data: { name: "Demo Project", key: "DEMO", slug: "demo-project" },
    });

    expect(result.key).toBe("DEMO");
    expect(mockDb.project.create).toHaveBeenCalledOnce();
    expect(getMockArg(mockDb.project.create)).toMatchObject({
      data: { orgId: VALID_ORG_ID },
    });
  });

  it("rejects lowercase project key", async () => {
    /**
     * roleGuard executes BEFORE Zod validates the input — the membership mock
     * must be set so roleGuard passes. Zod then rejects the lowercase key.
     */
    mockDb.membership.findUnique.mockResolvedValue({ role: "MEMBER" });

    await expect(
      authed().projects.create({
        orgId: VALID_ORG_ID,
        data: { name: "Demo", key: "demo", slug: "demo" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mockDb.project.create).not.toHaveBeenCalled();
  });
});

describe("projects.update", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates and returns the project", async () => {
    mockDb.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
    mockDb.project.findUnique.mockResolvedValue(mockProject);
    mockDb.project.update.mockResolvedValue({ ...mockProject, name: "Updated" });

    const result = await authed().projects.update({
      orgId: VALID_ORG_ID,
      projectId: VALID_UUID,
      data: { name: "Updated" },
    });

    expect(result.name).toBe("Updated");
  });

  it("throws NOT_FOUND when project missing", async () => {
    mockDb.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
    mockDb.project.findUnique.mockResolvedValue(null);

    await expect(
      authed().projects.update({
        orgId: VALID_ORG_ID,
        projectId: ANOTHER_UUID,
        data: { name: "X" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.project.update).not.toHaveBeenCalled();
  });
});

describe("projects.delete", () => {
  it("deletes the project and returns success", async () => {
    mockDb.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
    mockDb.project.findUnique.mockResolvedValue(mockProject);
    mockDb.project.delete.mockResolvedValue(mockProject);

    const result = await authed().projects.delete({
      orgId: VALID_ORG_ID,
      projectId: VALID_UUID,
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.project.delete).toHaveBeenCalledWith({ where: { id: VALID_UUID } });
  });

  it("throws NOT_FOUND when project does not exist", async () => {
    mockDb.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
    mockDb.project.findUnique.mockResolvedValue(null);

    await expect(
      authed().projects.delete({ orgId: VALID_ORG_ID, projectId: ANOTHER_UUID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.project.delete).not.toHaveBeenCalled();
  });
});
