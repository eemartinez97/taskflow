import { connection, type NextRequest, NextResponse } from "next/server";
import { prisma } from "@taskflow/database";
import { testRouteGuardResponse } from "@/lib/http/test-route-guard";

/**
 * POST /api/test/delete-org  { orgId: string }
 *
 * E2E-only backdoor: deletes ONE org by id (cascades through Membership,
 * Project, Board, Column, Task, Label, etc - see schema.prisma). Called
 * automatically after every test that used createIsolatedOrg (see
 * tests/e2e/support/fixtures.ts's `page` fixture teardown), so a single
 * suite run doesn't accumulate hundreds of throwaway orgs under the shared
 * seeded admin mid-run - this is the per-test complement to the
 * once-per-run reset in /api/test/reset/route.ts. Without this, a long run
 * (--repeat-each, or just a big suite) progressively slows down every
 * org-switcher render for the REST of that same run, which is exactly the
 * "passes with 6 workers, fails with fewer / repeated" symptom.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  await connection();
  const guardResponse = testRouteGuardResponse(req);
  if (guardResponse) return guardResponse;
  const body = (await req.json().catch(() => null)) as { orgId?: string } | null;
  if (!body?.orgId) {
    return NextResponse.json({ error: "Missing 'orgId'." }, { status: 400 });
  }
  await prisma.org.deleteMany({ where: { id: body.orgId } });
  return NextResponse.json({ ok: true });
}
