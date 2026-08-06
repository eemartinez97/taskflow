import { describe, it, expect, vi } from "vitest";
import { cleanupExpiredRateLimits } from "../../src/scripts/cleanup-expired-rate-limits";
import type { PrismaClient } from "../../src/generated";

function createMockDb(deletedCount: number): PrismaClient {
  return {
    rateLimitBucket: {
      deleteMany: vi.fn().mockResolvedValue({ count: deletedCount }),
    },
  } as unknown as PrismaClient;
}

describe("cleanupExpiredRateLimits", () => {
  it("deletes buckets whose window has already closed", async () => {
    const db = createMockDb(5);
    const result = await cleanupExpiredRateLimits(db);

    expect(result.deletedCount).toBe(5);
    expect(db.rateLimitBucket.deleteMany).toHaveBeenCalledWith({
      where: { resetAt: { lt: expect.any(Date) as Date } },
    });
  });

  it("returns 0 when there is nothing to delete", async () => {
    const db = createMockDb(0);
    const result = await cleanupExpiredRateLimits(db);
    expect(result.deletedCount).toBe(0);
  });
});
