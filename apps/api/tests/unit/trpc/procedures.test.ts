import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/env.js");

import { createCallerFactory, createTRPCRouter, TRPCError } from "../../../src/trpc/init.js";
import { protectedProcedure, publicProcedure, roleGuard } from "../../../src/trpc/procedures.js";
import { type Role } from "@taskflow/shared";
import { makeCtx, VALID_ORG_ID, VALID_USER } from "../../helpers.js";
import { mockDb } from "../../mocks/database-mock.js";

// Test routers

/** Minimal test router with one public and one protected procedure. */
const testRouter = createTRPCRouter({
  ping: publicProcedure.query(() => "pong"),
  whoami: protectedProcedure.query(({ ctx }) => ctx.user.email),
  guardedAction: protectedProcedure
    .use(roleGuard(["OWNER", "ADMIN"]))
    .input((input) => {
      if (
        input === null ||
        typeof input !== "object" ||
        !("orgId" in input) ||
        typeof (input as Record<string, unknown>).orgId !== "string"
      ) {
        throw new Error("Expected input with orgId string");
      }
      return input as { orgId: string };
    })
    .query(
      ({ ctx }) => `allowed as ${(ctx as unknown as { membershipRole: string }).membershipRole}`,
    ),
});

const createCaller = createCallerFactory(testRouter);

describe("publicProcedure", () => {
  it("resolves without authentication", async () => {
    expect(await createCaller(makeCtx(null)).ping()).toBe("pong");
  });

  it("resolves when a user IS authenticated", async () => {
    expect(await createCaller(makeCtx(VALID_USER)).ping()).toBe("pong");
  });
});

describe("protectedProcedure", () => {
  it("throws UNAUTHORIZED when user is null", async () => {
    await expect(createCaller(makeCtx(null)).whoami()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("resolves and returns user email when authenticated", async () => {
    expect(await createCaller(makeCtx(VALID_USER)).whoami()).toBe(VALID_USER.email);
  });
});

describe("roleGuard", () => {
  beforeEach(() => vi.resetAllMocks());

  it("throws BAD_REQUEST when orgId is empty string", async () => {
    // Pass an input without orgId trigger the BAD_REQUEST branch
    await expect(
      createCaller(makeCtx(VALID_USER)).guardedAction({ orgId: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws FORBIDDEN when user is not a member of the org", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(null);
    await expect(
      createCaller(makeCtx(VALID_USER)).guardedAction({ orgId: VALID_ORG_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when member role is not in allowedRoles", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "VIEWER" satisfies Role });
    await expect(
      createCaller(makeCtx(VALID_USER)).guardedAction({ orgId: VALID_ORG_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("resolves and attaches membershipRole when role is allowed", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "ADMIN" satisfies Role });
    expect(await createCaller(makeCtx(VALID_USER)).guardedAction({ orgId: VALID_ORG_ID })).toBe(
      "allowed as ADMIN",
    );
  });

  it("queries membership with correct orgId and userId", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "OWNER" satisfies Role });
    await createCaller(makeCtx(VALID_USER)).guardedAction({ orgId: VALID_ORG_ID });

    expect(mockDb.membership.findUnique).toHaveBeenCalledWith({
      where: { orgId_userId: { orgId: VALID_ORG_ID, userId: VALID_USER.id } },
      select: { role: true },
    });
  });

  it("throws UNAUTHORIZED when roleGuard is called with null user (defense-in-depth)", async () => {
    // Even though protectedProcedure guard first, roleGuard also checks
    // for a belt-and-suspenders defense
    const router = createTRPCRouter({
      action: publicProcedure
        .use(roleGuard(["OWNER"]))
        .input((i) => i as { orgId: string })
        .query(() => "ok"),
    });
    await expect(
      createCallerFactory(router)(makeCtx(null)).action({ orgId: VALID_ORG_ID }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("throws INTERNAL_SERVER_ERROR when membership role stored in DB is invalid", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "INVALID_ROLE" });
    await expect(
      createCaller(makeCtx(VALID_USER)).guardedAction({ orgId: VALID_ORG_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("throws BAD_REQUEST when input is not an object", async () => {
    await expect(
      createCaller(makeCtx(VALID_USER)).guardedAction(null as unknown as { orgId: string }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("TRPCError propagation", () => {
  it("is an instance of TRPCError", async () => {
    const caller = createCaller(makeCtx(null));
    try {
      await caller.whoami();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
    }
  });
});
