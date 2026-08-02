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

export async function countUnread(db: PrismaClient, userId: string): Promise<number> {
  return db.notification.count({ where: { userId, read: false } });
}
