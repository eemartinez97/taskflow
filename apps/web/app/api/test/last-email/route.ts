import { connection, type NextRequest, NextResponse } from "next/server";
import { inMemoryEmailSender } from "@/lib/mail/sender";
import { testRouteGuardResponse } from "@/lib/http/test-route-guard";

/**
 * GET /api/test/last-email?to=<email>
 *
 * E2E-only backdoor: returns the most recently captured email's html/text so
 * Playwright can extract a verification/reset token without a real mailbox
 * (see tests/e2e/helpers/auth.ts). See test-route-guard.ts for the
 * ENABLE_TEST_ROUTES gating rationale.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Forces this handler to execute on EVERY request instead of being
  // treated as static.
  //
  // WHY THIS IS REQUIRED: with `cacheComponents: true` (Next 16 / dynamicIO)
  // the legacy `export const dynamic = "force-dynamic"` segment config is
  // rejected at build time. The replacement is `connection()` - awaiting it
  // opts this route out of static/cached rendering, the same way reading
  // `cookies()` or `headers()` does. Without it, Next.js executes this GET
  // handler exactly ONCE at build time (before any email exists) and caches
  // that response forever, regardless of the `?to=` query string - which is
  // why E2E failed almost universally with "No email captured" once the
  // suite switched from `next dev` to a production build.
  await connection();

  const guardResponse = testRouteGuardResponse(req);
  if (guardResponse) return guardResponse;

  const to = req.nextUrl.searchParams.get("to");
  if (!to) {
    return NextResponse.json({ error: "Missing 'to' query parameter." }, { status: 400 });
  }

  const email = inMemoryEmailSender.findLastEmailTo(to);
  if (!email) {
    return NextResponse.json({ error: "No email captured for that address." }, { status: 404 });
  }

  return NextResponse.json({ subject: email.subject, html: email.html, text: email.text });
}
