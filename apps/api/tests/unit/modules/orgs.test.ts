import { beforeEach, describe, expect, vi, it } from "vitest";

vi.mock("../../../src/config/env.js");

import { createCallerFactory, createTRPCRouter } from "../../../src/trpc/init.js";
import { orgsRouter } from "../../../src/modules/orgs/router.js";
import {
  ANOTHER_UUID,
  getMockArg,
  makeCtx,
  VALID_ORG_ID,
  VALID_USER,
  VALID_UUID,
} from "../../helpers.js";
import { mockDb } from "../../mocks/database-mock.js";

const caller = createCallerFactory(createTRPCRouter({ orgs: orgsRouter }));
const authed = () => caller(makeCtx(VALID_USER));

const FIXED_DATE = new Date("2026-06-06T00:00:00.000Z");

const mockOrg = {
  id: VALID_ORG_ID,
  name: "Acme Corp",
  slug: "acme-corp",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

const mockMembership = {
  id: VALID_UUID,
  orgId: VALID_ORG_ID,
  userId: VALID_USER.id,
  role: "OWNER" as const,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

describe("orgs.list", () => {
  beforeEach(() => vi.resetAllMocks());

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(caller(makeCtx(null)).orgs.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns orgs with membership role", async () => {
    mockDb.membership.findMany.mockResolvedValueOnce([
      {
        ...mockMembership,
        org: mockOrg,
      },
    ]);
    const result = await authed().orgs.list();
    expect(result).toHaveLength(1);
    expect(result[0]?.membership.role).toBe("OWNER");
  });

  it("returns empty array when user has no orgs", async () => {
    mockDb.membership.findMany.mockResolvedValueOnce([]);
    expect(await authed().orgs.list()).toEqual([]);
  });
});

describe("orgs.create", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates an org and returns it", async () => {
    mockDb.org.create.mockResolvedValueOnce(mockOrg);
    const result = await authed().orgs.create({ name: "Acme Corp", slug: "acme-corp" });

    expect(result.slug).toBe("acme-corp");
    expect(mockDb.org.create).toHaveBeenCalledOnce();
    expect(getMockArg(mockDb.org.create)).toMatchObject({
      data: {
        name: "Acme Corp",
        slug: "acme-corp",
        memberships: { create: { userId: VALID_USER.id, role: "OWNER" } },
      },
    });
  });

  it("rejects invalid slug", async () => {
    await expect(
      authed().orgs.create({ name: "Acme", slug: "INVALID SLUG" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("orgs.update", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates and returns the org", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    mockDb.org.findUnique.mockResolvedValueOnce(mockOrg);
    mockDb.org.update.mockResolvedValueOnce({ ...mockOrg, name: "Acme Inc" });

    const result = await authed().orgs.update({
      orgId: VALID_ORG_ID,
      data: { name: "Acme Inc" },
    });

    expect(result.name).toBe("Acme Inc");
  });

  it("throws NOT_FOUND when org does not exist", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" });
    mockDb.org.findUnique.mockResolvedValueOnce(null);

    await expect(
      authed().orgs.update({ orgId: VALID_ORG_ID, data: { name: "X" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN when role is MEMBER", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });

    await expect(
      authed().orgs.update({ orgId: VALID_ORG_ID, data: { name: "X" } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("orgs.delete", () => {
  beforeEach(() => vi.resetAllMocks());

  it("deletes the org and returns success", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    mockDb.org.findUnique.mockResolvedValueOnce(mockOrg);
    mockDb.org.delete.mockResolvedValueOnce(mockOrg);

    expect(await authed().orgs.delete({ orgId: VALID_ORG_ID })).toEqual({ success: true });
  });

  it("throws FORBIDDEN when role is ADMIN", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" });
    await expect(authed().orgs.delete({ orgId: VALID_ORG_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws NOT_FOUND when org does not exist", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    mockDb.org.findUnique.mockResolvedValueOnce(null); // org not found

    await expect(authed().orgs.delete({ orgId: VALID_ORG_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // deleteOrg (db.org.delete) must NOT be called when org doesn't exist
    expect(mockDb.org.delete).not.toHaveBeenCalled();
  });
});

describe("orgs.members", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns list of members with user info", async () => {
    const member = {
      ...mockMembership,
      user: {
        id: ANOTHER_UUID,
        name: "Bob",
        email: "bob@example.com",
      },
    };
    mockDb.membership.findMany.mockResolvedValueOnce([member]);

    const result = await authed().orgs.members({ orgId: VALID_ORG_ID });
    expect(result).toHaveLength(1);
    expect(result[0]?.user.email).toBe("bob@example.com");
  });
});

describe("orgs.invite", () => {
  beforeEach(() => vi.resetAllMocks());

  it("invites a user and returns the membership", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" });
    mockDb.user.findUnique.mockResolvedValueOnce({ id: ANOTHER_UUID, email: "bob@example.com" });
    mockDb.membership.create.mockResolvedValueOnce({
      ...mockMembership,
      userId: ANOTHER_UUID,
      role: "MEMBER",
    });

    const result = await authed().orgs.invite({
      orgId: VALID_ORG_ID,
      data: { email: "bob@example.com", role: "MEMBER" },
    });

    expect(result.role).toBe("MEMBER");
  });

  it("throws NOT_FOUND when the invited email has no TaskFlow account", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" });
    mockDb.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      authed().orgs.invite({
        orgId: VALID_ORG_ID,
        data: { email: "ghost@example.com", role: "MEMBER" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("re-throws Error instances whose message does NOT start with NO_USER", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" });
    mockDb.user.findUnique.mockResolvedValueOnce({ id: ANOTHER_UUID, email: "bob@example.com" });

    const uniqueConstraintError = new Error(
      "Unique constraint failed on the fields: (`orgId`,`userId`)",
    );
    mockDb.membership.create.mockRejectedValueOnce(uniqueConstraintError);

    await expect(
      authed().orgs.invite({
        orgId: VALID_ORG_ID,
        data: { email: "bob@example.com", role: "MEMBER" },
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("rejects OWNER role in invite (schema enforced)", async () => {
    // roleGuard runs BEFORE Zod input validation in tRPC's middleware chain.
    // We must let roleGuard pass first so Zod gets a chance to reject "OWNER".
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" });

    // Cast through unknown to simulate a bad runtime payload reaching the
    // tRPC boundary — TypeScript correctly excludes "OWNER" from the type,
    // so we bypass the compile-time check intentionally here to verify that
    // Zod's runtime validation also rejects it.
    await expect(
      authed().orgs.invite({
        orgId: VALID_ORG_ID,
        data: { email: "bob@example.com", role: "OWNER" as unknown as "ADMIN" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("orgs.removeMember", () => {
  beforeEach(() => vi.resetAllMocks());

  it("removes a member and returns success", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "OWNER" });
    mockDb.membership.delete.mockResolvedValueOnce(mockMembership);

    const result = await authed().orgs.removeMember({
      orgId: VALID_ORG_ID,
      userId: ANOTHER_UUID,
    });

    expect(result).toEqual({ success: true });
  });
});
