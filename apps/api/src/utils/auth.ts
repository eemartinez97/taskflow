import { hkdfSync } from "node:crypto";
import { jwtDecrypt } from "jose";

import { parseCookieToken } from "@taskflow/shared";
import { env } from "../config/env";

export interface AuthSession {
  id: string;
  email: string;
  name: string | null;
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
 * the Cookie header. No database round-trip (stateless JWE decryption).
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

    return {
      id: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    // Token is invalid, expired, or tampered with
    return null;
  }
}
