import { connection, type NextRequest, NextResponse } from "next/server";
import { prisma } from "@taskflow/database";
import { testRouteGuardResponse } from "@/lib/http/test-route-guard";

const SEED_USER_EMAIL = "admin@taskflow.dev";
const SEED_ORG_SLUG = "demo-org";

/**
 * POST /api/test/reset
 *
 * E2E-only backdoor: wipes every Org and User created by test runs, leaving
 * only the data from packages/database/prisma/seed.ts (the "Demo
 * Organization" + admin@taskflow.dev).
 *
 * WHY THIS EXISTS: most e2e specs create disposable orgs via
 * `createIsolatedOrg` (see tests/e2e/helpers/org.ts) under the SAME seeded
 * admin account (shared storageState) and never delete them. Over repeated
 * full-suite runs (`--repeat-each`, or just running the suite many times
 * locally/CI without recreating the DB), that admin's org list grows
 * without bound. That, in turn, makes every org-switcher refetch/render
 * slower over the life of a long-lived environment - the root cause behind
 * flakes that only appear with lower parallelism or --repeat-each (more
 * wall-clock time == more accumulated orgs by the time later tests run).
 *
 * See test-route-guard.ts for the ENABLE_TEST_ROUTES gating rationale.
 *
 * NOTE: does NOT touch RateLimitBucket - lib/auth/rate-limit.ts's
 * checkRateLimitBucket() skips the DB entirely whenever isE2ERun() is true,
 * so no e2e run ever writes a row there in the first place. An earlier
 * version of this route cleared that table too; removed once the bypass
 * made it dead code (same guard condition on both, so there was never a
 * state the bypass didn't already cover and this route reset was needed).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Opts this route out of static/cached rendering under cacheComponents -
  // see /api/test/last-email/route.ts for the full rationale.
  await connection();

  const guardResponse = testRouteGuardResponse(req);
  if (guardResponse) return guardResponse;

  // Deleting every non-seed Org cascades (onDelete: Cascade) through
  // Membership, Project, Board, Column, Task, TaskLabel, Label, Comment,
  // Attachment - see schema.prisma.
  await prisma.org.deleteMany({
    where: { slug: { not: SEED_ORG_SLUG } },
  });

  // Deleting every non-seed User cascades through Membership, Session,
  // Account, AuthToken. Task.assigneeId/creatorId use onDelete: SetNull, so
  // this can't leave a dangling FK even if a task somehow outlived its org.
  await prisma.user.deleteMany({
    where: { email: { not: SEED_USER_EMAIL } },
  });

  return NextResponse.json({ ok: true });
}
