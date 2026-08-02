import type { PrismaClient } from "@taskflow/database";
import type { SessionUser, UpdateUser } from "@taskflow/shared";

import { deleteUserSessions, findUserById, updateUser } from "./repo";
import { TRPCError } from "../../trpc/init";

export async function getMe(db: PrismaClient, userId: string): Promise<SessionUser> {
  const user = await findUserById(db, userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
  return user;
}

export async function signOutUser(db: PrismaClient, userId: string): Promise<{ success: true }> {
  await deleteUserSessions(db, userId);
  return { success: true };
}

export async function updateMyProfile(
  db: PrismaClient,
  userId: string,
  data: UpdateUser,
): Promise<SessionUser> {
  await getMe(db, userId); // NOT_FOUND if the account was deleted
  return updateUser(db, userId, data);
}
