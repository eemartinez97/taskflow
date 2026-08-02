import type { PrismaClient } from "@taskflow/database";

/**
 * Org ids the user belongs to - scopes global presence broadcasts to the
 * rooms the user's teammates are listening on.
 *
 * TODO(perf): called on every connection (and reconnection under
 * connectionStateRecovery). If membership churn is low, cache per userId
 * with a short TTL.
 */
export async function findUserOrgIds(db: PrismaClient, userId: string): Promise<string[]> {
  const rows = await db.membership.findMany({
    where: { userId },
    select: { orgId: true },
  });

  return rows.map((row) => row.orgId);
}
