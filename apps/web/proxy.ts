import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "./lib/env.server";
import { getToken } from "next-auth/jwt";

/** Public routes that an authenticated user should not access */
const PUBLIC_AUTH_ROUTES = ["/", "/login", "/register"];

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
