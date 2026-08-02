import { parseCookie } from "cookie";

/**
 * Extracts the NextAuth v4 session token from a raw Cookie header string.
 *
 * Supports both HTTP and HTTPS cookie names:
 *   - next-auth.session-token          (http)
 *   - __Secure-next-auth.session-token (https)
 *
 * Pure function - no side effects, no external dependencies.
 * Single source of truth shared by apps/api and apps/web.
 */
export function parseCookieToken(rawCookies: string | null): string | null {
  if (!rawCookies) return null;

  const cookies = parseCookie(rawCookies);
  const token =
    cookies["next-auth.session-token"] ?? cookies["__Secure-next-auth.session-token"] ?? null;

  return token !== "" ? token : null;
}
