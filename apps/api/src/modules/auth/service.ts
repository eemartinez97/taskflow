import type { PrismaClient } from "@taskflow/database";
import type { SessionUser } from "@taskflow/shared";

import { deleteUserSessions, findUserById } from "./repo.js";
import { TRPCError } from "../../trpc/init.js";

export async function getMe(db: PrismaClient, userId: string): Promise<SessionUser> {
  const user = await findUserById(db, userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
  return user;
}

export async function signOutUser(db: PrismaClient, userId: string): Promise<{ success: boolean }> {
  await deleteUserSessions(db, userId);
  return { success: true };
}
