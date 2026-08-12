import type { PrismaClient } from "../generated";
import { runCleanupCli, type CleanupResult } from "./run-cleanup";

/**
 * PENDING invitations stay past their own `expiresAt` for at least this long
 * before being deleted - an admin can still see (and resend, via a fresh
 * `invitations.create` upsert) a freshly-expired one in the org table for a
 * while instead of it vanishing the moment it lapses.
 */
export const STALE_INVITATION_GRACE_DAYS = 30;

/**
 * Deletes PENDING Invitation rows whose `expiresAt` passed more than
 * `graceDays` ago. DECLINED/REVOKED/ACCEPTED rows are left alone - they're
 * resolved history, not clutter. Without this, every invite nobody ever
 * responded to is a permanent row.
 *
 * Exported as a pure function (injectable PrismaClient) so it's unit
 * testable without spinning up the CLI entrypoint below.
 */
export async function cleanupStaleInvitations(
  db: PrismaClient,
  graceDays: number = STALE_INVITATION_GRACE_DAYS,
): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
  const { count } = await db.invitation.deleteMany({
    where: { status: "PENDING", expiresAt: { lt: cutoff } },
  });
  return { deletedCount: count };
}

/* v8 ignore next 3 -- CLI entrypoint, exercised manually / via cron, not unit tested */
if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  runCleanupCli("stale invitation(s)", cleanupStaleInvitations);
}
