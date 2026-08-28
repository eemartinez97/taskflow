import { hkdfSync } from "node:crypto";
import { jwtDecrypt } from "jose";

import {
  createLastSeenThrottle,
  createPasswordChangedAtCache,
  parseCookieToken,
} from "@taskflow/shared";
import { prisma } from "@taskflow/database";
import { env } from "../config/env";
import { fireAndForget } from "./fire-and-forget";

export interface AuthSession {
  id: string;
  email: string;
  name: string | null;
}

/**
 * `null` means the user no longer exists at all - distinct from
 * `{ passwordChangedAtMs: null }`, which means the user exists but has never
 * reset their password. getSessionUser must reject the former outright
 * (nothing to check a timestamp against), not treat it as "nothing to
 * revoke" the way it correctly does for the latter.
 */
type PasswordChangedAtLookup = { passwordChangedAtMs: number | null } | null;

/**
 * Caches each user's `passwordChangedAt` (TTL from env.PASSWORD_CHANGED_AT_
 * CACHE_TTL_MS, 60s by default) so getSessionUser's revocation check below
 * doesn't pay a DB round-trip on every request - see
 * createPasswordChangedAtCache's docblock in packages/shared for the full
 * rationale and the reason this app owns the `fetch` callback (its own
 * Prisma client) while the cache mechanics live in packages/shared, shared
 * with apps/web's identical need. apps/web reads the same env var for its
 * own, independent cache instance - keep both configured the same way when
 * changing the TTL, or the two apps' revocation windows will diverge.
 */
const passwordChangedAtCache = createPasswordChangedAtCache<PasswordChangedAtLookup>(
  env.PASSWORD_CHANGED_AT_CACHE_TTL_MS,
);

async function getPasswordChangedAt(userId: string): Promise<PasswordChangedAtLookup> {
  return passwordChangedAtCache.get(userId, async (id) => {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { passwordChangedAt: true },
    });
    if (!user) return null;
    return { passwordChangedAtMs: user.passwordChangedAt?.getTime() ?? null };
  });
}

/** Test-only: clears the cache so each test starts from a clean cache state. */
export function __resetPasswordChangedAtCacheForTest(): void {
  passwordChangedAtCache.reset();
}

/**
 * Throttle window for touchLastSeen below - keeps a chatty client (a
 * realtime board with cursors/presence, or a burst of tRPC calls) from
 * writing User.lastSeenAt on every single request. Own instance here (own
 * process, own Prisma client) of packages/shared's createLastSeenThrottle -
 * unlike passwordChangedAt, apps/web's own RSC session path never needs to
 * share this cache - only apps/api's own tRPC context and Socket.IO
 * handshake call getSessionUser (see socket/server.ts and trpc/init.ts).
 * apps/web's lib/auth/session.ts owns an identical, independent instance for
 * its own RSC page-view path - keep both configured with the same TTL.
 */
const ACTIVE_USER_LASTSEEN_THROTTLE_MS = 5 * 60 * 1000;
const lastSeenThrottle = createLastSeenThrottle(ACTIVE_USER_LASTSEEN_THROTTLE_MS);

/** Test-only: clears the throttle so each test starts from a clean state. */
export function __resetLastSeenThrottleForTest(): void {
  lastSeenThrottle.reset();
}

/**
 * Best-effort, throttled write backing the activeUsersTotal Prometheus
 * gauge (metrics/db-gauges.ts). Fire-and-forget: a failed write must never
 * turn an otherwise-valid session into a rejected one, and the caller
 * (every authenticated request) shouldn't wait behind it.
 *
 * Known gap: apps/web's own RSC page-view path (lib/auth/session.ts) never
 * calls getSessionUser - it's driven by socket handshakes and apps/api's
 * own tRPC context, both of which typically fire close to page load (the
 * dashboard shell connects its socket on mount), so an authenticated
 * session is captured here shortly after it's opened. A user who somehow
 * never triggers either (no realtime connection, no tRPC mutation) in a
 * given visit won't be counted for that visit.
 */
function touchLastSeen(userId: string): void {
  if (!lastSeenThrottle.shouldWrite(userId)) return;

  // Promise.resolve(...) wrapper: makes this robust even if the update call
  // itself is a mock returning a non-Promise value (see auth.test.ts) - the
  // real Prisma client always returns a genuine Promise anyway.
  fireAndForget(
    Promise.resolve(
      prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }),
    ).then(() => undefined),
    "getSessionUser: failed to update lastSeenAt",
    { userId },
  );
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
    // see getPasswordChangedAt's docblock for why this is the one exception
    // to this function otherwise never touching the database. Also rejects
    // outright when the user no longer exists (e.g. deleted) - a still-live
    // session cookie for a nonexistent user must not keep authenticating.
    const lookup = await getPasswordChangedAt(payload.sub);
    if (lookup === null) return null;
    if (lookup.passwordChangedAtMs !== null && lookup.passwordChangedAtMs > payload.iat * 1000) {
      return null;
    }

    touchLastSeen(payload.sub);

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
