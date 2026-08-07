import { connection, NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Docker healthcheck target for the web container - `next start` in
 * standalone mode has no built-in health endpoint. Mirrors apps/api's
 * /healthz: no auth, no DB check, just "the Node process is alive and
 * serving requests".
 */
export async function GET(): Promise<NextResponse> {
  // See /api/test/last-email/route.ts for why this is required under
  // cacheComponents - without it this handler runs once at build time and
  // its response is cached forever, which would defeat the healthcheck.
  await connection();

  return NextResponse.json({ status: "ok" });
}
