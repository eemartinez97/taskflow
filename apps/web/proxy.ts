import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "./lib/env.server";
import { getToken } from "next-auth/jwt";

/**
 * Public routes that redirect an ALREADY authenticated user to /projects.
 * Makes no sense for a signed-in user to see the landing page or the
 * login/register forms again.
 */
const PUBLIC_AUTH_ROUTES = ["/", "/login", "/register"];

/**
 * Public routes that stay accessible REGARDLESS of session state.
 *
 * These carry a single-use token in the query string that identifies a
 * specific action (confirm email, reset password) independent of whoever
 * happens to be logged in in the current browser - e.g. an admin testing an
 * invite link while already signed in as themselves, or a user opening a
 * stale reset link from an old session. Redirecting them to /projects would
 * make the link silently unusable.
 */
const ALWAYS_ACCESSIBLE_ROUTES = ["/verify-email", "/forgot-password", "/reset-password"];

/**
 * Next.js 16 proxy (replaces middleware.ts - deprecated in Next.js 16).
 * Runs on the Edge Runtime before any rendering.
 *
 * Redirects unauthenticated users to /login for all protected routes.
 * Uses getToken() from next-auth/jwt - reads + decodes the JWT session
 * cookie directly with no DB round-trip and no Server Component blocking.
 */

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: serverEnv.NEXTAUTH_SECRET,
  });

  const isAuthenticated = token !== null;
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.includes(pathname);
  const isAlwaysAccessibleRoute = ALWAYS_ACCESSIBLE_ROUTES.includes(pathname);

  // Always-accessible routes short-circuit before either auth redirect -
  // reachable both signed-in and signed-out.
  if (isAlwaysAccessibleRoute) {
    return NextResponse.next();
  }

  // An already-authenticated visitor opening their own invite link
  // (?invite=<token> on /register) still needs to land on the accept/decline
  // page, not get swept into rule 1 below - they already have an account.
  if (isAuthenticated && pathname === "/register") {
    const inviteToken = request.nextUrl.searchParams.get("invite");
    if (inviteToken) {
      return NextResponse.redirect(new URL(`/invitations/${inviteToken}`, request.url));
    }
  }

  // 1. If authenticated and trying to access /, /login, or /register -> redirect to /projects
  if (isAuthenticated && isPublicAuthRoute) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  // 2. If NOT authenticated and trying to access a protected route -> redirect to /login

  if (!isAuthenticated && !isPublicAuthRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Otherwise, continue normally
  return NextResponse.next();
}

export const config = {
  /**
   * Runs the proxy on ALL routes EXCEPT:
   * - API routes (/api, /trpc)
   * - Next.js internal files (_next/static, _next/image)
   * - Favicon and files with extensions (e.g., .png, .css)
   */
  matcher: ["/((?!api|trpc|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
