import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/env.js");

import { createCallerFactory, createTRPCRouter } from "../../../src/trpc/init.js";
import { labelsRouter } from "../../../src/modules/labels/router.js";
import {
  ANOTHER_UUID,
  FIXED_DATE,
  makeCtx,
  VALID_ORG_ID,
  VALID_USER,
  VALID_UUID,
} from "../../helpers.js";
import { mockDb } from "../../mocks/database-mock.js";

const caller = createCallerFactory(createTRPCRouter({ labels: labelsRouter }));
const authed = () => caller(makeCtx(VALID_USER));

const mockLabel = {
  id: VALID_UUID,
  orgId: VALID_ORG_ID,
  name: "Bug",
  color: "#EF4444",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

describe("labels.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(caller(makeCtx(null)).labels.list({ orgId: VALID_ORG_ID })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns labels for the org", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.label.findMany.mockResolvedValueOnce([mockLabel]);

    const result = await authed().labels.list({ orgId: VALID_ORG_ID });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe(mockLabel.name);
  });

  it("returns empty array when org has no labels", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.label.findMany.mockResolvedValueOnce([]);

    const result = await authed().labels.list({ orgId: VALID_ORG_ID });

    expect(result).toHaveLength(0);
  });

  it("throws FORBIDDEN when role is VIEWER", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "VIEWER" });

    await expect(authed().labels.list({ orgId: VALID_ORG_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("labels.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(
      caller(makeCtx(null)).labels.create({
        orgId: VALID_ORG_ID,
        data: mockLabel,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates a label and return it", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" });
    mockDb.label.create.mockResolvedValueOnce(mockLabel);

    const result = await authed().labels.create({
      orgId: VALID_ORG_ID,
      data: { ...mockLabel },
    });

    expect(result.name).toBe(mockLabel.name);
    expect(result.color).toBe(mockLabel.color);
  });

  it("rejects invalid hex color", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" });

    await expect(
      authed().labels.create({
        orgId: VALID_ORG_ID,
        data: { ...mockLabel, color: "red" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws FORBIDDEN for MEMBER role", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });

    await expect(
      authed().labels.create({
        orgId: VALID_ORG_ID,
        data: mockLabel,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("labels.delete", () => {
  beforeAll(() => vi.clearAllMocks());

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(
      caller(makeCtx(null)).labels.delete({
        orgId: VALID_ORG_ID,
        labelId: ANOTHER_UUID,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("deletes a label and returns success", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" });
    mockDb.label.delete.mockResolvedValueOnce(mockLabel);

    const result = await authed().labels.delete({
      orgId: VALID_ORG_ID,
      labelId: ANOTHER_UUID,
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.label.delete).toHaveBeenCalledWith({
      where: { id: ANOTHER_UUID },
    });
  });

  it("throws FORBIDDEN for MEMBER role", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });

    await expect(
      authed().labels.delete({
        orgId: VALID_ORG_ID,
        labelId: ANOTHER_UUID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
