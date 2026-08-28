import "server-only";
import { getServerSession } from "next-auth";
import { cache } from "react";

import { prisma } from "@taskflow/database";
import { createLastSeenThrottle, type SessionUser } from "@taskflow/shared";

import { authOptions } from "@/auth";
import { logger } from "@/lib/utils/logger";

/**
 * Same throttle window/mechanics as apps/api's identical touchLastSeen in
 * utils/auth.ts - own instance here (own process, own Prisma client) of
 * packages/shared's createLastSeenThrottle, same "each app owns its own
 * in-process cache" convention this codebase already uses for
 * passwordChangedAt (see session-revocation.ts).
 *
 * WHY THIS HALF EXISTS SEPARATELY: apps/api's getSessionUser is only ever
 * called via a browser tRPC mutation or a Socket.IO handshake - an RSC page
 * view that does neither (getSession() below, resolved entirely
 * in-process via getServerSession) never reaches it, so a user who only
 * ever browses pages would never be counted toward activeUsersTotal
 * without this.
 */
const ACTIVE_USER_LASTSEEN_THROTTLE_MS = 5 * 60 * 1000;
const lastSeenThrottle = createLastSeenThrottle(ACTIVE_USER_LASTSEEN_THROTTLE_MS);

/** Test-only: clears the throttle so each test starts from a clean state. */
export function __resetLastSeenThrottleForTest(): void {
  lastSeenThrottle.reset();
}

function touchLastSeen(userId: string): void {
  if (!lastSeenThrottle.shouldWrite(userId)) return;

  // Best-effort, fire-and-forget - a failed write must never affect the
  // session this request already resolved.
  Promise.resolve(
    prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }),
  ).catch((error: unknown) => {
    logger.error({ err: error, userId }, "getSession: failed to update lastSeenAt");
  });
}

/**
 * Memoized per request with React cache(): TeamPage calls getSession()
 * directly AND through getServerTRPC's context - without cache() that is
 * two getServerSession() reads per request.
 */

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.id || !session.user.email) return null;

  const { id, email, name, image } = session.user;

  touchLastSeen(id);

  return { id, email, name: name ?? null, image: image ?? null };
});
