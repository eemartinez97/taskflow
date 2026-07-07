import { parseCookieToken, type SessionUser } from "@taskflow/shared";
import { prisma, validateSessionToken } from "@taskflow/database";

/**
 * Validates a NextAuth v4 session token from HTTP request headers.
 *
 * 1. Extracts the token from the Cookie header via parseCookieToken (@taskflow/shared).
 * 2. Validates against the Session table via validateSessionToken (@taskflow/database).
 *
 * Returns SessionUser (from @taskflow/shared) or null.
 */
export async function getServerSessionFromHeaders(headers: Headers): Promise<SessionUser | null> {
  const token = parseCookieToken(headers.get("cookie"));
  if (!token) return null;

  try {
    return await validateSessionToken(prisma, token);
  } catch {
    return null;
  }
}
