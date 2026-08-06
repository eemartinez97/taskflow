import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated";

// dotenv 17 - pass quiet:true to suppress the startup log line
dotenv.config({ quiet: true });

/** Accounts that never confirmed their email longer than this are deleted. */
export const ABANDONED_REGISTRATION_TTL_DAYS = 7;

export interface CleanupResult {
  deletedCount: number;
}

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

/* v8 ignore start -- CLI entrypoint, exercised manually / via cron, not unit tested */
async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });
  try {
    const { deletedCount } = await cleanupAbandonedRegistrations(db);
    console.log(`Cleanup complete: removed ${String(deletedCount)} abandoned registration(s).`);
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  main().catch((error: unknown) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  });
}
/* v8 ignore stop */
