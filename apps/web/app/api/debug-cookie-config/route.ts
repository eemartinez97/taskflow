import { connection, NextResponse } from "next/server";
import { authOptions } from "@/auth";

/**
 * TEMPORARY diagnostic route - delete after the cross-subdomain cookie
 * investigation is resolved. Returns exactly what `authOptions.cookies`
 * looks like at runtime on THIS deployment, to tell apart "our config is
 * wrong" from "next-auth mishandles a correct config on Vercel specifically"
 * - see PR #62/#63 for context. No secrets in the response.
 */
export async function GET(): Promise<NextResponse> {
  await connection();

  return NextResponse.json({
    cookies: authOptions.cookies,
    nodeEnv: process.env.NODE_ENV,
    cookieDomainSet: Boolean(process.env.COOKIE_DOMAIN),
    nextAuthUrlStartsHttps: Boolean(process.env.NEXTAUTH_URL?.startsWith("https://")),
  });
}
