import type { PrismaClient } from "@taskflow/database";
import type { SessionUser, UpdateUser } from "@taskflow/shared";
import { stripUndefined } from "../../utils/prisma";

const userSessionSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
} as const;

/**
 * Finds a user by id for the `me` procedure.
 * Returns only the fields the client needs - never the full user row.
 */
export async function findUserById(db: PrismaClient, userId: string): Promise<SessionUser | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: userSessionSelect,
  });
}

/**
 * Deletes all sessions for a user (server-side sign-out)
 * NextAuth v4 handles session deletion on the web side too,
 * but this lets the API invalidate sessions independently
 */
export async function deleteUserSessions(db: PrismaClient, userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export async function updateUser(
  db: PrismaClient,
  userId: string,
  data: UpdateUser,
): Promise<SessionUser> {
  return db.user.update({
    where: { id: userId },
    data: stripUndefined(data),
    select: userSessionSelect,
  });
}
