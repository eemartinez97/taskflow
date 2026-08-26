import "server-only";
import { prisma } from "@taskflow/database";
import { createPasswordChangedAtCache } from "@taskflow/shared";
import { serverEnv } from "@/lib/env.server";

/**
 * `null` means the user no longer exists at all - distinct from
 * `{ passwordChangedAtMs: null }`, which means the user exists but has never
 * reset their password. isSessionRevoked must treat the former as revoked
 * outright (nothing to check a timestamp against), not as "nothing to
 * revoke" the way it correctly does for the latter.
 */
type PasswordChangedAtLookup = { passwordChangedAtMs: number | null } | null;

/**
 * Caches each user's `passwordChangedAt` for PASSWORD_CHANGED_AT_CACHE_TTL_MS
 * (60s by default) - see createPasswordChangedAtCache's docblock in
 * packages/shared for the full rationale. Same mechanism as apps/api's
 * identical need in utils/auth.ts, each app owning its own `fetch` callback
 * and its own in-process cache instance.
 */
const passwordChangedAtCache = createPasswordChangedAtCache<PasswordChangedAtLookup>(
  serverEnv.PASSWORD_CHANGED_AT_CACHE_TTL_MS,
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
export function __resetSessionRevocationCacheForTest(): void {
  passwordChangedAtCache.reset();
}

/**
 * True when a session issued at `issuedAtSeconds` (a JWT `iat` claim) predates
 * the user's most recent password reset, and must therefore be treated as
 * revoked.
 *
 * WHY THIS EXISTS: NextAuth's JWT session strategy is stateless by design -
 * `getServerSession`/`useSession` never touch the database, so a session
 * cookie issued before a password reset would otherwise keep working
 * indefinitely on every Server Component and RSC-driven tRPC query (the
 * apps/api HTTP path already closes this gap for client-side mutations via
 * its own getSessionUser check; this closes the same gap for the read path
 * that runs inside apps/web itself). Failing closed on a missing `iat` -
 * rather than trusting an unstamped token - matches getSessionUser's stance.
 */
export async function isSessionRevoked(
  userId: string,
  issuedAtSeconds: number | undefined,
): Promise<boolean> {
  if (typeof issuedAtSeconds !== "number") return true;

  try {
    const lookup = await getPasswordChangedAt(userId);
    // A deleted user (lookup === null) must be treated as revoked - a
    // still-live session cookie for a nonexistent user must not keep
    // authenticating.
    if (lookup === null) return true;
    return (
      lookup.passwordChangedAtMs !== null && lookup.passwordChangedAtMs > issuedAtSeconds * 1000
    );
  } catch {
    // DB unavailable - fail closed, same stance as apps/api's getSessionUser.
    return true;
  }
}
