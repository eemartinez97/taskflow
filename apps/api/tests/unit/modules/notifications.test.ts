import { beforeEach, describe, expect, vi, it } from "vitest";

vi.mock("../../../src/config/env.js");

import { createCallerFactory, createTRPCRouter } from "../../../src/trpc/init.js";
import { notificationsRouter } from "../../../src/modules/notifications/router.js";
import {
  ANOTHER_UUID,
  FIXED_DATE,
  makeCtx,
  VALID_TASK_ID,
  VALID_USER,
  VALID_UUID,
} from "../../helpers.js";
import type { PrismaClient, NotificationWithActor } from "@taskflow/database";
import { mockDb } from "../../mocks/database-mock.js";
import {
  buildNotificationMessage,
  notifyTaskAssigned,
} from "../../../src/modules/notifications/service.js";

const caller = createCallerFactory(createTRPCRouter({ notifications: notificationsRouter }));
const authed = () => caller(makeCtx(VALID_USER));

const mockNotification: NotificationWithActor = {
  id: VALID_UUID,
  userId: VALID_USER.id,
  actorId: ANOTHER_UUID,
  type: "COMMENT_CREATED",
  message: 'Bob commented on "Fix login bug"',
  read: false,
  entityId: ANOTHER_UUID,
  entityType: "task",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  actor: { id: ANOTHER_UUID, name: "Bob", image: null },
};

describe("notifications.list", () => {
  beforeEach(() => vi.resetAllMocks());

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(caller(makeCtx(null)).notifications.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns notifications and unread count", async () => {
    mockDb.notification.findMany.mockResolvedValueOnce([mockNotification]);
    mockDb.notification.count.mockResolvedValueOnce(1);

    const result = await authed().notifications.list();

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.actor?.name).toBe(mockNotification.actor?.name);
    expect(result.unreadCount).toBe(1);
  });

  it("returns empty notifications and zero unread count", async () => {
    mockDb.notification.findMany.mockResolvedValueOnce([]);
    mockDb.notification.count.mockResolvedValueOnce(0);

    const result = await authed().notifications.list();

    expect(result.notifications).toHaveLength(0);
    expect(result.unreadCount).toBe(0);
  });

  it("queries with correct userId and ordering", async () => {
    mockDb.notification.findMany.mockResolvedValueOnce([]);
    mockDb.notification.count.mockResolvedValueOnce(0);

    await authed().notifications.list();

    expect(mockDb.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: VALID_USER.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });

  it("counts only unread notifications", async () => {
    mockDb.notification.findMany.mockResolvedValueOnce([]);
    mockDb.notification.count.mockResolvedValueOnce(3);

    await authed().notifications.list();

    expect(mockDb.notification.count).toHaveBeenCalledWith({
      where: { userId: VALID_USER.id, read: false },
    });
  });

  it("runs findMany and count in parallel (Promise.all)", async () => {
    // Both mocks must resolve for the result to arrive
    mockDb.notification.findMany.mockResolvedValueOnce([mockNotification]);
    mockDb.notification.count.mockResolvedValueOnce(1);

    const result = await authed().notifications.list();

    // Both were called exactly once
    expect(mockDb.notification.findMany).toHaveBeenCalledOnce();
    expect(mockDb.notification.count).toHaveBeenCalledOnce();
    expect(result.unreadCount).toBe(1);
  });
});

describe("notifications.markRead", () => {
  beforeEach(() => vi.resetAllMocks());

  it("marks specific notifications as read", async () => {
    mockDb.notification.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await authed().notifications.markRead({ ids: [VALID_UUID] });

    expect(result.count).toBe(1);
    expect(mockDb.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [VALID_UUID] }, userId: VALID_USER.id },
      data: { read: true },
    });
  });

  it("rejects empty ids array", async () => {
    await expect(authed().notifications.markRead({ ids: [] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("scopes update to current user (cannot mark other users notifications)", async () => {
    mockDb.notification.updateMany.mockResolvedValueOnce({ count: 0 });

    await authed().notifications.markRead({ ids: [ANOTHER_UUID] });

    expect(mockDb.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: VALID_USER.id }) as unknown,
      }),
    );
  });

  it("returns count 0 when no matching notifications found", async () => {
    mockDb.notification.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await authed().notifications.markRead({ ids: [ANOTHER_UUID] });
    expect(result.count).toBe(0);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(
      caller(makeCtx(null)).notifications.markRead({ ids: [VALID_UUID] }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("notifications.markAllRead", () => {
  beforeEach(() => vi.resetAllMocks());

  it("marks all unread notifications as read", async () => {
    mockDb.notification.updateMany.mockResolvedValueOnce({ count: 5 });

    const result = await authed().notifications.markAllRead();

    expect(result.count).toBe(5);
    expect(mockDb.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: VALID_USER.id, read: false },
      data: { read: true },
    });
  });

  it("returns count 0 when all notifications were already read", async () => {
    mockDb.notification.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await authed().notifications.markAllRead();
    expect(result.count).toBe(0);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(caller(makeCtx(null)).notifications.markAllRead()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("notifications.delete", () => {
  beforeEach(() => vi.resetAllMocks());

  it("deletes a notification owned by the current user", async () => {
    mockDb.notification.delete.mockResolvedValueOnce(mockNotification);

    const result = await authed().notifications.delete({ notificationId: VALID_UUID });

    expect(result).toEqual({ success: true });
    expect(mockDb.notification.delete).toHaveBeenCalledWith({
      where: { id: VALID_UUID, userId: VALID_USER.id },
    });
  });

  it("throws NOT_FOUND when notification does not exist or belongs to another user", async () => {
    mockDb.notification.delete.mockRejectedValueOnce(new Error("P2025"));

    await expect(
      authed().notifications.delete({ notificationId: ANOTHER_UUID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(
      caller(makeCtx(null)).notifications.delete({ notificationId: VALID_UUID }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("buildNotificationMessage", () => {
  it("TASK_ASSIGNED with actor and title", () => {
    expect(buildNotificationMessage("TASK_ASSIGNED", "Alice", "Fix login bug")).toBe(
      'Alice assigned you to "Fix login bug"',
    );
  });

  it("TASK_ASSIGNED without title", () => {
    expect(buildNotificationMessage("TASK_ASSIGNED", "Alice")).toBe("Alice assigned you to a task");
  });

  it("TASK_UPDATED with actor and title", () => {
    expect(buildNotificationMessage("TASK_UPDATED", "Bob", "Add dark mode")).toBe(
      'Bob updated "Add dark mode"',
    );
  });

  it("TASK_UPDATED without title", () => {
    expect(buildNotificationMessage("TASK_UPDATED", null)).toBe("Someone updated a task");
  });

  it("COMMENT_CREATED with actor and title", () => {
    expect(buildNotificationMessage("COMMENT_CREATED", "Carol", "Refactor API")).toBe(
      'Carol commented on "Refactor API"',
    );
  });

  it("COMMENT_CREATED without title", () => {
    expect(buildNotificationMessage("COMMENT_CREATED", "Carol")).toBe("Carol left a comment");
  });

  it("MEMBER_INVITED uses actor name", () => {
    expect(buildNotificationMessage("MEMBER_INVITED", "Dave")).toBe(
      "Dave invited you to an organization",
    );
  });

  it("uses 'Someone' when actorName is null", () => {
    expect(buildNotificationMessage("TASK_ASSIGNED", null, "Task")).toBe(
      'Someone assigned you to "Task"',
    );
  });
});

describe("notifyTaskAssigned", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a TASK_ASSIGNED notification when assigneeId is set", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockDb.notification.create.mockResolvedValueOnce({});

    await notifyTaskAssigned(mockDb as unknown as PrismaClient, {
      taskId: VALID_TASK_ID,
      taskTitle: "Fix login bug",
      assigneeId: ANOTHER_UUID,
      actorId: VALID_USER.id,
    });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "TASK_ASSIGNED",
          userId: ANOTHER_UUID,
          message: 'Alice assigned you to "Fix login bug"',
        }) as unknown,
      }),
    );
  });

  it("no-ops when assigneeId is null", async () => {
    await notifyTaskAssigned(mockDb as unknown as PrismaClient, {
      taskId: VALID_TASK_ID,
      taskTitle: "Task",
      assigneeId: null,
      actorId: VALID_USER.id,
    });

    expect(mockDb.notification.create).not.toHaveBeenCalled();
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("no-ops when actor IS the assignee (self-assignment)", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });

    await notifyTaskAssigned(mockDb as unknown as PrismaClient, {
      taskId: VALID_TASK_ID,
      taskTitle: "Task",
      assigneeId: VALID_USER.id, // same as actorId
      actorId: VALID_USER.id,
    });

    // notify() has the self-notification guard - create must not be called
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("uses 'Someone' when actor exists in DB but has no display name", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ name: null });
    mockDb.notification.create.mockResolvedValueOnce({});

    await notifyTaskAssigned(mockDb as unknown as PrismaClient, {
      taskId: VALID_TASK_ID,
      taskTitle: "Deploy to production",
      assigneeId: ANOTHER_UUID,
      actorId: VALID_USER.id,
    });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining("Someone") as string,
        }) as unknown,
      }),
    );
  });

  it("uses 'Someone' when actor account no longer exists in DB (deleted account)", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);
    mockDb.notification.create.mockResolvedValueOnce({});

    await notifyTaskAssigned(mockDb as unknown as PrismaClient, {
      taskId: VALID_TASK_ID,
      taskTitle: "Fix critical bug",
      assigneeId: ANOTHER_UUID,
      actorId: VALID_USER.id,
    });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining("Someone") as string,
        }) as unknown,
      }),
    );
  });
});
