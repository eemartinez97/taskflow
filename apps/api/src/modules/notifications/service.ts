import type {
  Notification,
  NotificationType,
  NotificationWithActor,
  PrismaClient,
} from "@taskflow/database";
import { Prisma } from "@taskflow/database";

import {
  countUnread,
  createNotification,
  deleteMemberInvitedNotifications as deleteMemberInvitedNotificationsRepo,
  deleteNotification,
  findNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationsAsRead,
} from "./repo";
import { TRPCError } from "../../trpc/init";
import type { AppServer } from "../../socket/events";
import { type CreateNotification, SOCKET_EVENTS } from "@taskflow/shared";
import { emitToUser } from "../../socket/emit";

/**
 * Shared options for task-related notification helpers.
 * Both notifyTaskAssigned and notifyCommentCreated operate on the same data.
 */
export interface TaskNotificationOpts {
  type: Extract<NotificationType, "TASK_ASSIGNED" | "COMMENT_CREATED">;
  taskId: string;
  taskTitle: string;
  assigneeId: string | null;
  creatorId: string | null;
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
): Promise<{ success: true }> {
  try {
    await deleteNotification(db, notificationId, userId);
    return { success: true };
  } catch (err) {
    // P2025 = "An operation failed because it depends on one or more records
    // that were required but not found". Anything else (connection loss,
    // constraint violation) must NOT be reported to the client as a 404.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found." });
    }
    throw err;
  }
}

/**
 * Clears a user's MEMBER_INVITED notifications for one org - called once an
 * invitation to that org is resolved (accepted/declined) so a stale
 * notification from an earlier invite/decline cycle can't resurface with
 * Accept/Decline buttons when a later invite creates a new pending row for
 * the same org. See deleteMemberInvitedNotifications in ./repo for why a
 * fresh notification row exists per invite despite the Invitation row itself
 * being reused.
 */
export async function deleteMemberInvitedNotifications(
  db: PrismaClient,
  userId: string,
  orgId: string,
): Promise<void> {
  await deleteMemberInvitedNotificationsRepo(db, userId, orgId);
}

/**
 * Creates a notification for a single recipient
 * Silently no-ops when actor === recipient (no self-notifications)
 */
export async function notify(
  db: PrismaClient,
  io: AppServer,
  data: CreateNotification,
): Promise<Notification | null> {
  if (data.actorId && data.actorId === data.userId) return null;

  const notification = await createNotification(db, data);

  emitToUser(io, data.userId, SOCKET_EVENTS.NOTIFICATION_CREATED, { notification });

  return notification;
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
      return entityTitle
        ? `${actor} invited you to "${entityTitle}"`
        : `${actor} invited you to an organization`;
    case "INVITATION_ACCEPTED":
      return entityTitle
        ? `${actor} accepted your invitation to "${entityTitle}"`
        : `${actor} accepted your invitation`;
    case "INVITATION_DECLINED":
      return entityTitle
        ? `${actor} declined your invitation to "${entityTitle}"`
        : `${actor} declined your invitation`;
    case "MEMBER_LEFT":
      return entityTitle ? `${actor} left "${entityTitle}"` : `${actor} left the organization`;
    /* v8 ignore next 4 -- defensive exhaustiveness guard, unreachable by type system */
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/**
 * Fetches the actor's display name from the DB.
 * Returns null when the actor no longer exists (deleted account).
 * Extracted to avoid repeating the same findUnique call in every service -
 * exported so modules/invitations/service.ts can reuse it for invite/accept/
 * decline emails and notifications without a duplicate implementation.
 */
export async function getActorName(db: PrismaClient, actorId: string): Promise<string | null> {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { name: true } });

  return actor?.name ?? null;
}

/**
 * Core task notification helper - single source of truth for all
 * task-scoped notifications (TASK_ASSIGNED, COMMENT_CREATED, …).
 *
 * No-ops silently when:
 *  - assigneeId is null (no recipient)
 *  - actorId === assigneeId (self-notification guard inside notify())
 */
export async function notifyTaskEvent(
  db: PrismaClient,
  io: AppServer,
  opts: Omit<TaskNotificationOpts, "assigneeId" | "creatorId"> & {
    recipientIds: (string | null | undefined)[];
  },
): Promise<void> {
  // Deduplicate and remove nulls in one pass
  const recipients = [...new Set(opts.recipientIds.filter(Boolean))] as string[];
  if (recipients.length === 0) return;

  const actorName = await getActorName(db, opts.actorId);

  await Promise.all(
    recipients.map((userId) =>
      notify(db, io, {
        userId,
        actorId: opts.actorId,
        type: opts.type,
        message: buildNotificationMessage(opts.type, actorName, opts.taskTitle),
        entityId: opts.taskId,
        entityType: "task",
      }),
    ),
  );
}

/** Notifies the assignee when a task is assigned to them */
export async function notifyTaskAssigned(
  db: PrismaClient,
  io: AppServer,
  opts: Omit<TaskNotificationOpts, "type">,
): Promise<void> {
  await notifyTaskEvent(db, io, {
    ...opts,
    type: "TASK_ASSIGNED",
    recipientIds: [opts.assigneeId],
  });
}

/** Notifies the assignee when someone comments on their task. */
export async function notifyCommentCreated(
  db: PrismaClient,
  io: AppServer,
  opts: Omit<TaskNotificationOpts, "type">,
): Promise<void> {
  await notifyTaskEvent(db, io, {
    ...opts,
    type: "COMMENT_CREATED",
    recipientIds: [opts.assigneeId, opts.creatorId],
  });
}

/** Notifies a user when they are added to an organization. */
export async function notifyMemberInvited(
  db: PrismaClient,
  io: AppServer,
  opts: { recipientId: string; actorId: string; orgId: string; orgName: string },
): Promise<void> {
  const actorName = await getActorName(db, opts.actorId);

  await notify(db, io, {
    userId: opts.recipientId,
    actorId: opts.actorId,
    type: "MEMBER_INVITED",
    message: buildNotificationMessage("MEMBER_INVITED", actorName, opts.orgName),
    entityId: opts.orgId,
    entityType: "org",
  });
}

/**
 * Notifies the original inviter when an invitation they sent is accepted or
 * declined. No-ops when `recipientId` is null - the inviter's account was
 * deleted (`Invitation.invitedById` is `onDelete: SetNull`), so there is no
 * one left to notify.
 */
export async function notifyInvitationResolved(
  db: PrismaClient,
  io: AppServer,
  opts: {
    recipientId: string | null;
    actorId: string;
    orgId: string;
    orgName: string;
    type: Extract<NotificationType, "INVITATION_ACCEPTED" | "INVITATION_DECLINED">;
  },
): Promise<void> {
  if (!opts.recipientId) return;

  const actorName = await getActorName(db, opts.actorId);

  await notify(db, io, {
    userId: opts.recipientId,
    actorId: opts.actorId,
    type: opts.type,
    message: buildNotificationMessage(opts.type, actorName, opts.orgName),
    entityId: opts.orgId,
    entityType: "org",
  });
}

/**
 * Notifies an org's OWNER/ADMIN members - plus the removed member themselves,
 * when this is an admin-initiated removal rather than a voluntary leave, so
 * they get a realtime signal that they lost access instead of finding out
 * from the next request that happens to 403 - that someone stopped being a
 * member. `actorId` is the real actor (the departing user for a voluntary
 * leave, the admin who removed them otherwise - see
 * modules/orgs/service.ts's removeMembershipAndNotify), which is also what
 * lets the message distinguish "X left" from "Y removed X". Self-notification
 * is a non-issue: `notify()`'s own actor===recipient guard silently skips the
 * actor themselves if they happen to also be in `recipientIds` (e.g. an
 * OWNER removing a member is in their own adminIds recipient list).
 */
export async function notifyMemberLeft(
  db: PrismaClient,
  io: AppServer,
  opts: {
    recipientIds: (string | null | undefined)[];
    actorId: string;
    removedUserId: string;
    orgId: string;
    orgName: string;
    taskCount: number;
  },
): Promise<void> {
  const recipients = [...new Set(opts.recipientIds.filter(Boolean))] as string[];
  if (recipients.length === 0) return;

  const isVoluntary = opts.actorId === opts.removedUserId;
  const [actorName, removedUserName] = await Promise.all([
    getActorName(db, opts.actorId),
    isVoluntary ? Promise.resolve(null) : getActorName(db, opts.removedUserId),
  ]);
  const base = isVoluntary
    ? buildNotificationMessage("MEMBER_LEFT", actorName, opts.orgName)
    : `${actorName ?? "An admin"} removed ${removedUserName ?? "a member"} from "${opts.orgName}"`;
  const message =
    opts.taskCount > 0
      ? `${base} · ${String(opts.taskCount)} ${opts.taskCount === 1 ? "task needs" : "tasks need"} reassignment`
      : base;

  await Promise.all(
    recipients.map((userId) =>
      notify(db, io, {
        userId,
        actorId: opts.actorId,
        type: "MEMBER_LEFT",
        message,
        entityId: opts.orgId,
        entityType: "org",
      }),
    ),
  );
}
