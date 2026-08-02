import "server-only";
import { getServerSession } from "next-auth";
import { cache } from "react";

import { type SessionUser } from "@taskflow/shared";

import { authOptions } from "@/auth";

/**
 * Memoized per request with React cache(): TeamPage calls getSession()
 * directly AND through getServerTRPC's context - without cache() that is
 * two getServerSession() reads per request.
 */

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.id || !session.user.email) return null;

  const { id, email, name, image } = session.user;

  return { id, email, name: name ?? null, image: image ?? null };
});
