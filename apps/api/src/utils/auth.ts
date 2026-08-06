import { hkdfSync } from "node:crypto";
import { jwtDecrypt } from "jose";

import { createPasswordChangedAtCache, parseCookieToken } from "@taskflow/shared";
import { prisma } from "@taskflow/database";
import { env } from "../config/env";

export interface AuthSession {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Caches each user's `passwordChangedAt` for 60s (the default TTL) so
 * getSessionUser's revocation check below doesn't pay a DB round-trip on
 * every request - see createPasswordChangedAtCache's docblock in
 * packages/shared for the full rationale and the reason this app owns the
 * `fetch` callback (its own Prisma client) while the cache mechanics live in
 * packages/shared, shared with apps/web's identical need.
 */
const passwordChangedAtCache = createPasswordChangedAtCache();

async function getPasswordChangedAtMs(userId: string): Promise<number | null> {
  return passwordChangedAtCache.get(userId, async (id) => {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { passwordChangedAt: true },
    });
    return user?.passwordChangedAt?.getTime() ?? null;
  });
}

/** Test-only: clears the cache so each test starts from a clean cache state. */
export function __resetPasswordChangedAtCacheForTest(): void {
  passwordChangedAtCache.reset();
}

/**
 * NextAuth v4 derives its JWE encryption key as:
 *   HKDF(sha256, secret, salt = "", info = "NextAuth.js Generated Encryption Key", 32)
 *
 * @auth/core (v5) derives it with a DIFFERENT info string that embeds the
 * cookie-name salt, so its decode() can never decrypt a v4 session cookie.
 * We replicate the v4 derivation here with node:crypto + jose.
 */
const V4_HKDF_INFO = "NextAuth.js Generated Encryption Key";

/** Derived once at startup - the secret never changes at runtime. */
const encryptionKey = new Uint8Array(hkdfSync("sha256", env.NEXTAUTH_SECRET, "", V4_HKDF_INFO, 32));

/**
 * Extracts and cryptographically verifies the NextAuth v4 JWT session from
 * the Cookie header. Stateless JWE decryption plus one cached, indexed
 * point read (see getPasswordChangedAtMs) - not a database session lookup.
 */
export async function getSessionUser(cookieHeader?: string | null): Promise<AuthSession | null> {
  if (!cookieHeader) return null;

  //  Extract the token
  const token = parseCookieToken(cookieHeader);
  if (!token) return null;

  try {
    // Same options NextAuth v4 uses internally (jwtDecrypt also validates `exp`)
    const { payload } = await jwtDecrypt(token, encryptionKey, { clockTolerance: 15 });

    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    if (typeof payload.iat !== "number") return null;

    // Reject a session issued before the user's most recent password reset -
    // see getPasswordChangedAtMs's docblock for why this is the one
    // exception to this function otherwise never touching the database.
    const passwordChangedAtMs = await getPasswordChangedAtMs(payload.sub);
    if (passwordChangedAtMs !== null && passwordChangedAtMs > payload.iat * 1000) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    // Token is invalid, expired, tampered with, or the revocation check
    // above failed (e.g. DB unavailable) - fail closed either way.
    return null;
  }
}
