import { type PrismaClient } from "./generated/index.js";
import { type SessionUser } from "@taskflow/shared";

/**
 * Validates a NextAuth v4 session token against the Session table.
 *
 * Returns null in ALL error cases — no information leakage.
 * The `db` parameter is injected so callers use their own PrismaClient
 * instance (singleton in apps/api, same singleton in apps/web).
 */
export async function validateSessionToken(
  db: PrismaClient,
  token: string,
): Promise<SessionUser | null> {
  const session = await db.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: { id: true, email: true, name: true, image: true },
      },
    },
  });

  if (!session || session.expires <= new Date()) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}
