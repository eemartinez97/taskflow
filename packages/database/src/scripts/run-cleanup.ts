import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated";

// dotenv 17 - pass quiet:true to suppress the startup log line
dotenv.config({ quiet: true });

export interface CleanupResult {
  deletedCount: number;
}

/* v8 ignore start -- CLI-only bootstrap, exercised manually / via cron, not unit tested */

/**
 * Shared CLI bootstrap for the cleanup scripts (cleanup-abandoned-registrations,
 * cleanup-expired-rate-limits, cleanup-stale-invitations): constructs a real
 * PrismaClient, runs the given cleanup function, logs the result, and always
 * disconnects.
 */
async function runCleanup(
  label: string,
  cleanup: (db: PrismaClient) => Promise<CleanupResult>,
): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });
  try {
    const { deletedCount } = await cleanup(db);
    console.log(`Cleanup complete: removed ${String(deletedCount)} ${label}.`);
  } finally {
    await db.$disconnect();
  }
}

/**
 * Entrypoint each cleanup script calls behind its own
 * `import.meta.url === ...` guard, so `pnpm --filter @taskflow/database
 * cleanup:x` runs exactly that one job, not all three.
 */
export function runCleanupCli(
  label: string,
  cleanup: (db: PrismaClient) => Promise<CleanupResult>,
): void {
  runCleanup(label, cleanup).catch((error: unknown) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  });
}

/* v8 ignore stop */
