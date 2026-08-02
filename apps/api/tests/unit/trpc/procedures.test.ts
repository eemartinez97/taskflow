import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { baseProcedure, createTRPCRouter } from "../../../src/trpc/init";
import { protectedProcedure, publicProcedure, roleGuard } from "../../../src/trpc/procedures";
import {
  ANOTHER_UUID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_ID,
  VALID_USER,
} from "../../helpers";
import { mockDb } from "../../mocks/database-mock";
import { callerFor, denyMembership, expectTRPCError, grantRole } from "../../support/trpc";

const scopedRouter = createTRPCRouter({
  scoped: protectedProcedure
    .use(roleGuard(["OWNER", "ADMIN", "MEMBER"]))
    .input(z.object({ orgId: z.string(), projectId: z.string(), taskId: z.string() }))
    .query(() => "ok"),
});

const scopedInput = { orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID, taskId: VALID_TASK_ID };

/** Router built once with every shape roleGuard has to survive. */
const testRouter = createTRPCRouter({
  open: publicProcedure.query(() => "public"),
  me: protectedProcedure.query(({ ctx }) => ctx.user.id),

  admin: protectedProcedure
    .use(roleGuard(["OWNER", "ADMIN"]))
    .input(z.object({ orgId: z.string() }))
    .query(({ ctx }) => ctx.membershipRole),

  // No .input() -> getRawInput() resolves to undefined
  noInput: protectedProcedure.use(roleGuard(["OWNER"])).query(() => "never"),

  // Primitive input -> typeof rawInput !== "object"
  stringInput: protectedProcedure
    .use(roleGuard(["OWNER"]))
    .input(z.string())
    .query(() => "never"),

  // roleGuard WITHOUT protectedProcedure -> belt-and-suspenders branch
  unguarded: baseProcedure
    .use(roleGuard(["OWNER"]))
    .input(z.object({ orgId: z.string() }))
    .query(() => "never"),

  objectWithoutOrgId: protectedProcedure
    .use(roleGuard(["OWNER"]))
    .input(z.object({ notOrgId: z.string() }))
    .query(() => "never"),
});

const input = { orgId: VALID_ORG_ID };

describe("publicProcedure", () => {
  it("runs without a session", async () => {
    await expect(callerFor(testRouter, null).open()).resolves.toBe("public");
  });
});

describe("protectedProcedure (isAuthed)", () => {
  it("rejects anonymous callers with UNAUTHORIZED", async () => {
    await expectTRPCError(callerFor(testRouter, null).me(), "UNAUTHORIZED");
  });

  it("narrows ctx.user to non-null", async () => {
    await expect(callerFor(testRouter).me()).resolves.toBe(VALID_USER.id);
  });
});

describe("roleGuard", () => {
  beforeEach(() => {
    grantRole("ADMIN");
  });

  it("rejects when composed without protectedProcedure and no user", async () => {
    await expectTRPCError(callerFor(testRouter, null).unguarded(input), "UNAUTHORIZED");
  });

  it.each([
    ["input is undefined", () => callerFor(testRouter).noInput()],
    ["input is a primitive", () => callerFor(testRouter).stringInput("not-an-object")],
    ["orgId is an empty string", () => callerFor(testRouter).admin({ orgId: "" })],
    [
      "input is an object but orgId key is absent",
      () => callerFor(testRouter).objectWithoutOrgId({ notOrgId: "value" }),
    ],
  ])("throws BAD_REQUEST when %s", async (_name, call) => {
    await expectTRPCError(call(), "BAD_REQUEST");
  });

  it("looks the membership up by the composite key", async () => {
    await callerFor(testRouter).admin(input);

    expect(mockDb.membership.findUnique).toHaveBeenCalledWith({
      where: { orgId_userId: { orgId: VALID_ORG_ID, userId: VALID_USER.id } },
      select: { role: true },
    });
  });

  it("throws FORBIDDEN when the caller is not a member", async () => {
    denyMembership();

    await expectTRPCError(callerFor(testRouter).admin(input), "FORBIDDEN");
  });

  it("throws FORBIDDEN when the role is not allowed", async () => {
    grantRole("MEMBER");

    await expectTRPCError(callerFor(testRouter).admin(input), "FORBIDDEN");
  });

  it("lists the allowed roles in the FORBIDDEN message", async () => {
    grantRole("MEMBER");

    await expect(callerFor(testRouter).admin(input)).rejects.toThrow(/OWNER, ADMIN/);
  });

  it("throws INTERNAL_SERVER_ERROR when the stored role is unknown", async () => {
    grantRole("SUPER_DUPER_ADMIN");

    await expectTRPCError(callerFor(testRouter).admin(input), "INTERNAL_SERVER_ERROR");
  });

  it.each(["OWNER", "ADMIN"])("attaches membershipRole to ctx for %s", async (role) => {
    grantRole(role);

    await expect(callerFor(testRouter).admin(input)).resolves.toBe(role);
  });
});

describe("roleGuard tenancy scoping", () => {
  beforeEach(() => {
    grantRole("MEMBER");
    mockDb.project.findUnique.mockResolvedValue({ orgId: VALID_ORG_ID });
    mockDb.task.findUnique.mockResolvedValue({
      column: { board: { project: { orgId: VALID_ORG_ID } } },
    });
  });

  it("allows ids that belong to the org", async () => {
    await expect(callerFor(scopedRouter).scoped(scopedInput)).resolves.toBe("ok");
  });

  it("rejects a project from another org with NOT_FOUND", async () => {
    mockDb.project.findUnique.mockResolvedValue({ orgId: ANOTHER_UUID });

    await expectTRPCError(callerFor(scopedRouter).scoped(scopedInput), "NOT_FOUND");
  });

  it("rejects a task from another org with NOT_FOUND", async () => {
    mockDb.task.findUnique.mockResolvedValue({
      column: { board: { project: { orgId: ANOTHER_UUID } } },
    });

    await expectTRPCError(callerFor(scopedRouter).scoped(scopedInput), "NOT_FOUND");
  });

  it("rejects ids that do not exist at all", async () => {
    mockDb.project.findUnique.mockResolvedValue(null);

    await expectTRPCError(callerFor(scopedRouter).scoped(scopedInput), "NOT_FOUND");
  });

  it("skips tenancy assertion for empty-string scope ids", async () => {
    await expect(
      callerFor(scopedRouter).scoped({
        orgId: VALID_ORG_ID,
        projectId: "", // typeof "" === "string" ✓ but "".length > 0 ✗ -> skip
        taskId: VALID_TASK_ID,
      }),
    ).resolves.toBe("ok");
    // assertProjectInOrg must NOT have been called - projectId was empty
    expect(mockDb.project.findUnique).not.toHaveBeenCalled();
    // taskId was non-empty, so its assertion still runs normally
    expect(mockDb.task.findUnique).toHaveBeenCalled();
  });
});
