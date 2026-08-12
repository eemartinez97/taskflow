import { describe, it, expect, vi } from "vitest";
import { cleanupStaleInvitations } from "../../src/scripts/cleanup-stale-invitations";
import type { PrismaClient } from "../../src/generated";

function createMockDb(deletedCount: number): PrismaClient {
  return {
    invitation: {
      deleteMany: vi.fn().mockResolvedValue({ count: deletedCount }),
    },
  } as unknown as PrismaClient;
}

describe("cleanupStaleInvitations", () => {
  it("deletes PENDING invitations past the grace period", async () => {
    const db = createMockDb(3);
    const result = await cleanupStaleInvitations(db);

    expect(result.deletedCount).toBe(3);
    expect(db.invitation.deleteMany).toHaveBeenCalledWith({
      where: { status: "PENDING", expiresAt: { lt: expect.any(Date) as Date } },
    });
  });

  it("accepts a custom grace period", async () => {
    const db = createMockDb(1);
    await cleanupStaleInvitations(db, 7);

    expect(db.invitation.deleteMany).toHaveBeenCalledWith({
      where: { status: "PENDING", expiresAt: { lt: expect.any(Date) as Date } },
    });
  });

  it("returns 0 when there is nothing to delete", async () => {
    const db = createMockDb(0);
    const result = await cleanupStaleInvitations(db);
    expect(result.deletedCount).toBe(0);
  });
});
