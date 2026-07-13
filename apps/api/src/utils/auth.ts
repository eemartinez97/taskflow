import { parseCookieToken } from "@taskflow/shared";
import { decode } from "@auth/core/jwt";
import { env, isProduction } from "../config/env";

export interface AuthSession {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Extracts and cryptographically verifies the JWT session from request headers.
 * Uses @auth/core to decode the token WITHOUT hitting the database (O(1) memory check).
 */
export async function getSessionUser(cookieHeader?: string | null): Promise<AuthSession | null> {
  if (!cookieHeader) return null;

  // 1. Extract the token
  const token = parseCookieToken(cookieHeader);
  if (!token) return null;

  // 2. Determine the salt (cookie name) used by NextAuth
  // In NextAuth v4/v5, the salt is the cookie name itself
  const salt = isProduction() ? "__Secure-next-auth.session-token" : "next-auth.session-token";

  try {
    // 3. Verify the JWT signature using @auth/core
    const decoded = await decode({ token, secret: env.NEXTAUTH_SECRET, salt });

    if (!decoded?.sub || !decoded.email) return null;

    return {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name ?? null,
    };
  } catch {
    // Token is invalid, expired, or tampered with
    return null;
  }
}
