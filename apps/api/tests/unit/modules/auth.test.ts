import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/env");

import { createCallerFactory, createTRPCRouter } from "../../../src/trpc/init";
import { authRouter } from "../../../src/modules/auth/router";
import { makeCtx, VALID_USER } from "../../helpers";
import { mockDb } from "../../mocks/database-mock";

const caller = createCallerFactory(createTRPCRouter({ auth: authRouter }));

describe("auth.me", () => {
  beforeEach(() => vi.resetAllMocks());

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(caller(makeCtx(null)).auth.me).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns the current user", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(VALID_USER);
    const result = await caller(makeCtx(VALID_USER)).auth.me();
    expect(result).toEqual(VALID_USER);
  });

  it("throws NOT_FOUND when user no longer exists in DB", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);
    await expect(caller(makeCtx(VALID_USER)).auth.me()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("queries by correct userId", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(VALID_USER);
    await caller(makeCtx(VALID_USER)).auth.me();
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: VALID_USER.id },
      select: { id: true, email: true, name: true, image: true },
    });
  });
});

describe("auth.signOut", () => {
  beforeEach(() => vi.resetAllMocks());

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(caller(makeCtx(null)).auth.signOut()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("deletes all sessions for the current user", async () => {
    mockDb.session.deleteMany.mockResolvedValueOnce({ count: 2 });
    const result = await caller(makeCtx(VALID_USER)).auth.signOut();
    expect(result).toEqual({ success: true });
    expect(mockDb.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: VALID_USER.id },
    });
  });
});
