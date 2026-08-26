import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@taskflow/database", async () => await import("@/tests/mocks/taskflow-database"));

import { mockDb } from "@/tests/mocks/taskflow-database";
import {
  __resetSessionRevocationCacheForTest,
  isSessionRevoked,
} from "@/lib/auth/session-revocation";

describe("isSessionRevoked", () => {
  const nowSeconds = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    __resetSessionRevocationCacheForTest();
    mockDb.user.findUnique.mockResolvedValue({ passwordChangedAt: null });
  });

  it("returns true (fail closed) when issuedAtSeconds is undefined", async () => {
    await expect(isSessionRevoked("user-1", undefined)).resolves.toBe(true);
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns false when the password has never been reset", async () => {
    await expect(isSessionRevoked("user-1", nowSeconds)).resolves.toBe(false);
  });

  it("returns false when the session was issued after the last password reset", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      passwordChangedAt: new Date((nowSeconds - 60) * 1000),
    });

    await expect(isSessionRevoked("user-1", nowSeconds)).resolves.toBe(false);
  });

  it("returns true when the session was issued before the last password reset", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      passwordChangedAt: new Date((nowSeconds + 60) * 1000),
    });

    await expect(isSessionRevoked("user-1", nowSeconds)).resolves.toBe(true);
  });

  it("looks up passwordChangedAt by userId", async () => {
    await isSessionRevoked("user-1", nowSeconds);

    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { passwordChangedAt: true },
    });
  });

  it("caches passwordChangedAt so a second call within the TTL doesn't re-query", async () => {
    await isSessionRevoked("user-1", nowSeconds);
    await isSessionRevoked("user-1", nowSeconds);

    expect(mockDb.user.findUnique).toHaveBeenCalledOnce();
  });

  it("re-queries once the cache entry is stale", async () => {
    const dateSpy = vi.spyOn(Date, "now");
    dateSpy.mockReturnValue(0);
    await isSessionRevoked("user-1", nowSeconds);

    dateSpy.mockReturnValue(60_001);
    await isSessionRevoked("user-1", nowSeconds);

    expect(mockDb.user.findUnique).toHaveBeenCalledTimes(2);
    dateSpy.mockRestore();
  });

  it("fails closed (returns true) when the passwordChangedAt lookup throws", async () => {
    mockDb.user.findUnique.mockRejectedValue(new Error("DB unavailable"));

    await expect(isSessionRevoked("user-1", nowSeconds)).resolves.toBe(true);
  });

  it("returns true (revoked) for a still-live session whose user no longer exists", async () => {
    // e.g. deleted after the session cookie was issued - user?.passwordChangedAt
    // ?? null would otherwise collapse this into the same "nothing to
    // revoke" case as a user who simply never reset their password.
    mockDb.user.findUnique.mockResolvedValue(null);

    await expect(isSessionRevoked("user-1", nowSeconds)).resolves.toBe(true);
  });
});
