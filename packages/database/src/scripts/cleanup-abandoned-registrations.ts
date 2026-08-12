import type { PrismaClient } from "../generated";
import { runCleanupCli, type CleanupResult } from "./run-cleanup";

/** Accounts that never confirmed their email longer than this are deleted. */
export const ABANDONED_REGISTRATION_TTL_DAYS = 7;

/**
 * Deletes User rows that never confirmed the emailed verification link
 * (`emailVerified` still null) and are older than the TTL.
 *
 * Safe by construction: a row with `emailVerified: null` can never sign in
 * (see authorizeCredentials's guard) and - being deleted before any org
 * membership can exist - cascades to nothing else (accounts/sessions FKs
 * are `onDelete: Cascade` and there are none yet for an unfinished signup).
 *
 * Exported as a pure function (injectable PrismaClient) so it's unit
 * testable without spinning up the CLI entrypoint below.
 */
export async function cleanupAbandonedRegistrations(
  db: PrismaClient,
  ttlDays: number = ABANDONED_REGISTRATION_TTL_DAYS,
): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
  const { count } = await db.user.deleteMany({
    where: { emailVerified: null, createdAt: { lt: cutoff } },
  });
  return { deletedCount: count };
}

/* v8 ignore next 3 -- CLI entrypoint, exercised manually / via cron, not unit tested */
if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  runCleanupCli("abandoned registration(s)", cleanupAbandonedRegistrations);
}
