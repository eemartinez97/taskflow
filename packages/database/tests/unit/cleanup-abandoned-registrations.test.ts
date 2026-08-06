import { describe, it, expect, vi } from "vitest";
import { cleanupAbandonedRegistrations } from "../../src/scripts/cleanup-abandoned-registrations";
import type { PrismaClient } from "../../src/generated";

function createMockDb(deletedCount: number): PrismaClient {
  return {
    user: {
      deleteMany: vi.fn().mockResolvedValue({ count: deletedCount }),
    },
  } as unknown as PrismaClient;
}

describe("cleanupAbandonedRegistrations", () => {
  it("deletes users with an unverified email older than the TTL", async () => {
    const db = createMockDb(3);
    const result = await cleanupAbandonedRegistrations(db, 7);

    expect(result.deletedCount).toBe(3);
    expect(db.user.deleteMany).toHaveBeenCalledWith({
      where: { emailVerified: null, createdAt: { lt: expect.any(Date) as Date } },
    });
  });

  it("uses the default TTL of 7 days when not specified", async () => {
    const db = createMockDb(0);
    await cleanupAbandonedRegistrations(db);

    const call = vi.mocked(db.user.deleteMany).mock.calls[0]?.[0] as {
      where: { createdAt: { lt: Date } };
    };
    const cutoff = call.where.createdAt.lt;
    const expectedCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // Allow a small delta for test execution time
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
  });

  it("returns 0 when there is nothing to delete", async () => {
    const db = createMockDb(0);
    const result = await cleanupAbandonedRegistrations(db);
    expect(result.deletedCount).toBe(0);
  });
});
