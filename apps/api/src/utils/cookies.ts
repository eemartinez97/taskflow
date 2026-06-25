import { parse } from "cookie";

/**
 * Extracts the NextAuth v4 session token from a raw Cookie header string.
 *
 * Supports both http (`next-auth.session-token`) and https
 * (`__Secure-next-auth.session-token`) cookie names.
 *
 * Extracted as a pure utility so both the Express auth middleware
 * and the Socket.IO handshake middleware can share the same logic
 * without coupling one layer to the other.
 */
export function parseCookieToken(rawCookies: string): string | null {
  if (!rawCookies) return null;

  const cookies = parse(rawCookies);
  const token =
    cookies["next-auth.session-token"] ?? cookies["__Secure-next-auth.session-token"] ?? null;

  return token !== "" ? token : null;
}
