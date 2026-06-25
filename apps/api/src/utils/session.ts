import type { PrismaClient, User } from "@taskflow/database";

export interface ValidatedSession {
  userId: string;
  email: string;
  name: string | null;
}

/**
 * Validates a NextAuth v4 session token against the database.
 *
 * Shared by the Express auth middleware (src/middleware/auth.ts) and
 * the Socket.IO handshake middleware (src/socket/server.ts) - the single
 * source of truth for session validation logic.
 *
 * Returns null when the token is missing, not found, or expired.
 * Callers translate null into the appropriate error for their layer
 * (HTTP 401 vs Socket.IO "UNAUTHORIZED")
 */
export async function validateSessionToken(
  db: PrismaClient,
  token: string,
): Promise<ValidatedSession | null> {
  // Select only the fields both consumers need - avoids over-fetching
  type UserSelect = Record<keyof Pick<User, "id" | "email" | "name">, true>;

  const session = await db.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: { id: true, email: true, name: true } satisfies UserSelect,
      },
    },
  });

  if (!session || session.expires <= new Date()) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  };
}
