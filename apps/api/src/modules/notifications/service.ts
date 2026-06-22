import { type CreateNotification } from "@taskflow/shared";
import type {
  Notification,
  NotificationType,
  NotificationWithActor,
  PrismaClient,
} from "@taskflow/database";
import {
  countUnread,
  createNotification,
  deleteNotification,
  findNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationsAsRead,
} from "./repo.js";
import { TRPCError } from "../../trpc/init.js";

/**
 * Shared options for task-related notification helpers.
 * Both notifyTaskAssigned and notifyCommentCreated operate on the same data.
 */
export interface TaskNotificationOpts {
  type: Extract<NotificationType, "TASK_ASSIGNED" | "COMMENT_CREATED">;
  taskId: string;
  taskTitle: string;
  assigneeId: string | null;
  actorId: string;
}

export async function listNotifications(
  db: PrismaClient,
  userId: string,
): Promise<{ notifications: NotificationWithActor[]; unreadCount: number }> {
  const [notifications, unreadCount] = await Promise.all([
    findNotificationsForUser(db, userId),
    countUnread(db, userId),
  ]);

  return { notifications, unreadCount };
}

export async function markReadById(
  db: PrismaClient,
  userId: string,
  ids: string[],
): Promise<{ count: number }> {
  return markNotificationsAsRead(db, userId, ids);
}

export async function markAllRead(db: PrismaClient, userId: string): Promise<{ count: number }> {
  return markAllNotificationsAsRead(db, userId);
}

export async function deleteNotificationById(
  db: PrismaClient,
  notificationId: string,
  userId: string,
): Promise<{ success: boolean }> {
  try {
    await deleteNotification(db, notificationId, userId);
    return { success: true };
  } catch {
    throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found." });
  }
}

/**
 * Creates a notification for a single recipient
 * Silently no-ops when actor === recipient (no self-notifications)
 */
export async function notify(
  db: PrismaClient,
  data: CreateNotification,
): Promise<Notification | null> {
  if (data.actorId && data.actorId === data.userId) return null;

  return createNotification(db, data);
}

export function buildNotificationMessage(
  type: NotificationType,
  actorName: string | null,
  entityTitle?: string,
): string {
  const actor = actorName ?? "Someone";

  switch (type) {
    case "TASK_ASSIGNED":
      return entityTitle
        ? `${actor} assigned you to "${entityTitle}"`
        : `${actor} assigned you to a task`;
    case "TASK_UPDATED":
      return entityTitle ? `${actor} updated "${entityTitle}"` : `${actor} updated a task`;
    case "COMMENT_CREATED":
      return entityTitle ? `${actor} commented on "${entityTitle}"` : `${actor} left a comment`;
    case "MEMBER_INVITED":
      return `${actor} invited you to an organization`;
  }
}

/**
 * Fetches the actor's display name from the DB.
 * Returns null when the actor no longer exists (deleted account).
 * Extracted to avoid repeating the same findUnique call in every service.
 */
async function getActorName(db: PrismaClient, actorId: string): Promise<string | null> {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { name: true } });

  return actor?.name ?? null;
}

/**
 * Core task notification helper — single source of truth for all
 * task-scoped notifications (TASK_ASSIGNED, COMMENT_CREATED, …).
 *
 * No-ops silently when:
 *  - assigneeId is null (no recipient)
 *  - actorId === assigneeId (self-notification guard inside notify())
 */
export async function notifyTaskEvent(db: PrismaClient, opts: TaskNotificationOpts): Promise<void> {
  if (!opts.assigneeId) return;

  const actorName = await getActorName(db, opts.actorId);

  await notify(db, {
    userId: opts.assigneeId,
    actorId: opts.actorId,
    type: opts.type,
    message: buildNotificationMessage(opts.type, actorName, opts.taskTitle),
    entityId: opts.taskId,
    entityType: "task",
  });
}

/** Notifies the assignee when a task is assigned to them */
export async function notifyTaskAssigned(
  db: PrismaClient,
  opts: Omit<TaskNotificationOpts, "type">,
): Promise<void> {
  await notifyTaskEvent(db, { ...opts, type: "TASK_ASSIGNED" });
}

/** Notifies the assignee when someone comments on their task. */
export async function notifyCommentCreated(
  db: PrismaClient,
  opts: Omit<TaskNotificationOpts, "type">,
): Promise<void> {
  await notifyTaskEvent(db, { ...opts, type: "COMMENT_CREATED" });
}
