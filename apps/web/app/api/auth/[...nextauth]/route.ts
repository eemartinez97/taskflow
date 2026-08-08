import { connection } from "next/server";
import NextAuth from "next-auth";

import { authOptions } from "@/auth";

/**
 * NextAuth v4 route handler for Next.js App Router.
 *
 * Binds the GET and POST handlers by NextAuth v4.
 * Do NOT use the v5 pattern (`export const { GET, POST } = handlers`) -
 * that API does not exist in v4.
 *
 * `context` (with its `params`) MUST be forwarded to the raw handler as-is -
 * NextAuth's own dispatcher branches on whether the 2nd argument has a
 * `.params` property to decide between its App Router and legacy Pages
 * Router code paths; dropping it silently sends every request down the
 * wrong one.
 *
 * `await connection()` opts this route out of Next 16 cacheComponents'
 * static optimization - see /api/health/route.ts's docblock for the
 * general rationale. Its absence here was a real production bug: the
 * Set-Cookie header NextAuth builds from `authOptions.cookies` (see
 * auth.ts) was missing httpOnly/sameSite/path/secure on Vercel even though
 * the exact same code produced the correct header locally - login appeared
 * to hang forever because the resulting cookie was silently rejected by
 * every browser, no error anywhere.
 */
interface RouteContext {
  params: Promise<Record<string, string | string[] | undefined>>;
}

const rawHandler = NextAuth(authOptions) as unknown as (
  req: Request,
  context: RouteContext,
) => Promise<Response>;

async function handler(req: Request, context: RouteContext): Promise<Response> {
  await connection();
  return rawHandler(req, context);
}

export { handler as GET, handler as POST };
