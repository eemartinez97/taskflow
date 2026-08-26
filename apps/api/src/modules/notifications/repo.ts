import { notificationWithActor } from "@taskflow/database";
import { type CreateNotification } from "@taskflow/shared";
import type { NotificationWithActor, PrismaClient } from "@taskflow/database";
import { stripUndefined } from "../../utils/prisma";

export async function findNotificationsForUser(
  db: PrismaClient,
  userId: string,
): Promise<NotificationWithActor[]> {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: notificationWithActor,
  });
}

export async function createNotification(
  db: PrismaClient,
  data: CreateNotification,
): Promise<NotificationWithActor> {
  return db.notification.create({
    data: stripUndefined(data),
    include: notificationWithActor,
  });
}

export async function markNotificationsAsRead(
  db: PrismaClient,
  userId: string,
  ids: string[],
): Promise<{ count: number }> {
  return db.notification.updateMany({
    where: { id: { in: ids }, userId },
    data: { read: true },
  });
}

export async function markAllNotificationsAsRead(
  db: PrismaClient,
  userId: string,
): Promise<{ count: number }> {
  return db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function deleteNotification(
  db: PrismaClient,
  notificationId: string,
  userId: string,
): Promise<void> {
  await db.notification.delete({ where: { id: notificationId, userId } });
}

/**
 * Deletes every MEMBER_INVITED notification a user has for one org.
 *
 * The `Invitation` row for a given (orgId, email) is reused across
 * decline -> re-invite (its `@@unique([orgId, email])` constraint - see
 * upsertInvitation), so its id never changes, but each invite/re-invite
 * still creates a NEW notification row. Called on accept/decline so a
 * resolved invite's notification doesn't sit around and start showing
 * Accept/Decline again the moment a later invite to the same org adds a
 * fresh `listMine` row - the notifications panel's `findInvitation` only
 * matches on orgId, not on which notification triggered it.
 */
export async function deleteMemberInvitedNotifications(
  db: PrismaClient,
  userId: string,
  orgId: string,
): Promise<void> {
  await db.notification.deleteMany({
    where: { userId, type: "MEMBER_INVITED", entityType: "org", entityId: orgId },
  });
}

export async function countUnread(db: PrismaClient, userId: string): Promise<number> {
  return db.notification.count({ where: { userId, read: false } });
}
