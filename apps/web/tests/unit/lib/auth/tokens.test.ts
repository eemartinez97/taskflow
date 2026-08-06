import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@taskflow/database";
import {
  AUTH_TOKEN_TTL_HOURS,
  TokenAlreadyConsumedError,
  consumeEmailVerification,
  consumeTokenAndResetPassword,
  findValidAuthToken,
  hashToken,
  invalidateOtherAuthTokens,
  issueAuthToken,
  verifyEmailFromToken,
} from "@/lib/auth/tokens";

function createMockDb(): PrismaClient {
  const db = {
    // Supports both Prisma transaction forms used across this module:
    // the array form (unused here now) and the interactive callback form
    // consume* uses - the callback just gets invoked with `db` itself,
    // which is enough for these tests since it exposes the same mocks.
    $transaction: vi.fn((arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(db);
      return Promise.all(arg as unknown[]);
    }),
    authToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
  };
  return db as unknown as PrismaClient;
}

describe("hashToken", () => {
  it("returns a deterministic SHA-256 hex digest", () => {
    expect(hashToken("same-input")).toBe(hashToken("same-input"));
  });

  it("returns different hashes for different inputs", () => {
    expect(hashToken("input-a")).not.toBe(hashToken("input-b"));
  });
});

describe("issueAuthToken", () => {
  it("returns a raw token and an expiry AUTH_TOKEN_TTL_HOURS in the future", async () => {
    const db = createMockDb();
    const before = Date.now();
    const { rawToken, expiresAt } = await issueAuthToken(db, "user-1", "EMAIL_VERIFICATION");
    const after = Date.now();

    expect(typeof rawToken).toBe("string");
    expect(rawToken.length).toBeGreaterThan(0);
    const expectedMin = before + AUTH_TOKEN_TTL_HOURS * 60 * 60 * 1000;
    const expectedMax = after + AUTH_TOKEN_TTL_HOURS * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it("creates the token without touching any previous token of the same type", async () => {
    const db = createMockDb();
    await issueAuthToken(db, "user-1", "PASSWORD_RESET");

    // Deletion is deferred to invalidateOtherAuthTokens, called only after
    // the caller confirms the new token's email actually sent - see
    // issueAuthToken's docblock for why (a failed send must not destroy the
    // still-working previous link).
    expect(db.authToken.deleteMany).not.toHaveBeenCalled();
    expect(db.authToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", type: "PASSWORD_RESET" }) as unknown,
      }),
    );
  });

  it("persists only the HASH of the token, never the raw value", async () => {
    const db = createMockDb();
    const { rawToken } = await issueAuthToken(db, "user-1", "EMAIL_VERIFICATION");

    const createCall = vi.mocked(db.authToken.create).mock.calls[0]?.[0] as {
      data: { tokenHash: string };
    };
    expect(createCall.data.tokenHash).toBe(hashToken(rawToken));
    expect(createCall.data.tokenHash).not.toBe(rawToken);
  });
});

describe("invalidateOtherAuthTokens", () => {
  it("deletes every other unconsumed token of the same type, keeping the current one", async () => {
    const db = createMockDb();
    await invalidateOtherAuthTokens(db, "user-1", "PASSWORD_RESET", "current-raw-token");

    expect(db.authToken.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        type: "PASSWORD_RESET",
        consumedAt: null,
        tokenHash: { not: hashToken("current-raw-token") },
      },
    });
  });
});

describe("findValidAuthToken", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns null when no record matches the token hash", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue(null);
    expect(await findValidAuthToken(db, "raw-token", "EMAIL_VERIFICATION")).toBeNull();
  });

  it("returns null when the record's type does not match", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "PASSWORD_RESET",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    expect(await findValidAuthToken(db, "raw-token", "EMAIL_VERIFICATION")).toBeNull();
  });

  it("returns null when the token was already consumed", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "EMAIL_VERIFICATION",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    expect(await findValidAuthToken(db, "raw-token", "EMAIL_VERIFICATION")).toBeNull();
  });

  it("returns null when the token has expired", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "EMAIL_VERIFICATION",
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    expect(await findValidAuthToken(db, "raw-token", "EMAIL_VERIFICATION")).toBeNull();
  });

  it("returns the token id and userId when the token is valid", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "EMAIL_VERIFICATION",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    expect(await findValidAuthToken(db, "raw-token", "EMAIL_VERIFICATION")).toEqual({
      id: "t1",
      userId: "u1",
    });
  });
});

describe("consumeEmailVerification", () => {
  it("marks the email verified and consumes the token", async () => {
    const db = createMockDb();
    await consumeEmailVerification(db, "token-1", "user-1");

    expect(db.authToken.updateMany).toHaveBeenCalledWith({
      where: { id: "token-1", consumedAt: null },
      data: { consumedAt: expect.any(Date) as Date },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { emailVerified: expect.any(Date) as Date },
    });
  });

  it("throws TokenAlreadyConsumedError and never verifies the account when a concurrent request already consumed the token", async () => {
    const db = createMockDb();
    vi.mocked(db.authToken.updateMany).mockResolvedValueOnce({ count: 0 });

    await expect(consumeEmailVerification(db, "token-1", "user-1")).rejects.toThrow(
      TokenAlreadyConsumedError,
    );
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe("verifyEmailFromToken", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns invalid when no record matches the token hash", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue(null);
    expect(await verifyEmailFromToken(db, "raw-token")).toEqual({ verified: false });
    expect(db.authToken.updateMany).not.toHaveBeenCalled();
  });

  it("returns invalid when the record's type does not match", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "PASSWORD_RESET",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    expect(await verifyEmailFromToken(db, "raw-token")).toEqual({ verified: false });
  });

  it("returns invalid when the token expired without ever being consumed", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "EMAIL_VERIFICATION",
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    expect(await verifyEmailFromToken(db, "raw-token")).toEqual({ verified: false });
    expect(db.authToken.updateMany).not.toHaveBeenCalled();
  });

  it("consumes an unconsumed, unexpired token and returns freshly activated", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "EMAIL_VERIFICATION",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    expect(await verifyEmailFromToken(db, "raw-token")).toEqual({
      verified: true,
      freshlyActivated: true,
      userId: "u1",
    });
    expect(db.authToken.updateMany).toHaveBeenCalledWith({
      where: { id: "t1", consumedAt: null },
      data: { consumedAt: expect.any(Date) as Date },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerified: expect.any(Date) as Date },
    });
  });

  it("rethrows unexpected errors from consumeEmailVerification", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "EMAIL_VERIFICATION",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(db.$transaction).mockRejectedValueOnce(new Error("DB error"));
    await expect(verifyEmailFromToken(db, "raw-token")).rejects.toThrow("DB error");
  });

  it("returns verified but NOT freshly activated for a concurrent request that loses the consume race", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "EMAIL_VERIFICATION",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(db.authToken.updateMany).mockResolvedValueOnce({ count: 0 });
    expect(await verifyEmailFromToken(db, "raw-token")).toEqual({
      verified: true,
      freshlyActivated: false,
      userId: "u1",
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("returns verified but NOT freshly activated for an already-consumed token whose user is verified (prefetch-then-click)", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "EMAIL_VERIFICATION",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      emailVerified: new Date(),
    } as never);
    expect(await verifyEmailFromToken(db, "raw-token")).toEqual({
      verified: true,
      freshlyActivated: false,
      userId: "u1",
    });
  });

  it("returns invalid for an already-consumed token whose user is somehow not verified", async () => {
    vi.mocked(db.authToken.findUnique).mockResolvedValue({
      id: "t1",
      userId: "u1",
      type: "EMAIL_VERIFICATION",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({ emailVerified: null } as never);
    expect(await verifyEmailFromToken(db, "raw-token")).toEqual({ verified: false });
  });
});

describe("consumeTokenAndResetPassword", () => {
  it("sets the new password and consumes the token", async () => {
    const db = createMockDb();
    await consumeTokenAndResetPassword(db, "token-1", "user-1", "hashed-pw");

    expect(db.authToken.updateMany).toHaveBeenCalledWith({
      where: { id: "token-1", consumedAt: null },
      data: { consumedAt: expect.any(Date) as Date },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "hashed-pw", passwordChangedAt: expect.any(Date) as Date },
    });
  });

  it("throws TokenAlreadyConsumedError and never resets the password when a concurrent request already consumed the token", async () => {
    const db = createMockDb();
    vi.mocked(db.authToken.updateMany).mockResolvedValueOnce({ count: 0 });

    await expect(
      consumeTokenAndResetPassword(db, "token-1", "user-1", "hashed-pw"),
    ).rejects.toThrow(TokenAlreadyConsumedError);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
