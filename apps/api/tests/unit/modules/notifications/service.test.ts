import { describe, expect, it } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";
import { Prisma, type NotificationType } from "@taskflow/database";

import {
  buildNotificationMessage,
  deleteNotificationById,
  listNotifications,
  markAllRead,
  markReadById,
  notify,
  notifyCommentCreated,
  notifyInvitationResolved,
  notifyMemberInvited,
  notifyTaskAssigned,
  notifyTaskEvent,
} from "../../../../src/modules/notifications/service";
import { buildNotificationWithActor } from "../../../factories";
import { ANOTHER_UUID, db, VALID_ORG_ID, VALID_TASK_ID, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockIo } from "../../../mocks/socket";
import { expectEmittedToUser, expectNoEmit } from "../../../support/socket-assert";

const notification = buildNotificationWithActor();

describe("listNotifications", () => {
  it("returns the page and the unread count in parallel", async () => {
    mockDb.notification.findMany.mockResolvedValueOnce([notification]);
    mockDb.notification.count.mockResolvedValueOnce(3);

    await expect(listNotifications(db, VALID_USER.id)).resolves.toEqual({
      notifications: [notification],
      unreadCount: 3,
    });
  });
});

describe("mark as read", () => {
  it("markReadById scopes to the owner", async () => {
    mockDb.notification.updateMany.mockResolvedValueOnce({ count: 2 });

    await expect(markReadById(db, VALID_USER.id, ["a", "b"])).resolves.toEqual({ count: 2 });
  });

  it("markAllRead", async () => {
    mockDb.notification.updateMany.mockResolvedValueOnce({ count: 7 });

    await expect(markAllRead(db, VALID_USER.id)).resolves.toEqual({ count: 7 });
  });
});

describe("deleteNotificationById", () => {
  it("reports success", async () => {
    await expect(deleteNotificationById(db, "n1", VALID_USER.id)).resolves.toEqual({
      success: true,
    });
  });

  it("maps a missing row to NOT_FOUND", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("Record to delete does not exist.", {
      code: "P2025",
      clientVersion: "7.0.0",
    });

    mockDb.notification.delete.mockRejectedValueOnce(err);

    await expect(deleteNotificationById(db, "n1", VALID_USER.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("re-throws unexpected errors without wrapping them", async () => {
    const networkError = new Error("Connection lost");
    mockDb.notification.delete.mockRejectedValueOnce(networkError);
    await expect(deleteNotificationById(db, "n1", VALID_USER.id)).rejects.toThrow(
      "Connection lost",
    );
  });
});

describe("notify", () => {
  it("creates the row and pushes it to the recipient's personal room", async () => {
    mockDb.notification.create.mockResolvedValueOnce(notification);

    const result = await notify(db, mockIo, {
      userId: ANOTHER_UUID,
      actorId: VALID_USER.id,
      type: "TASK_ASSIGNED",
      message: "msg",
      entityId: VALID_TASK_ID,
      entityType: "task",
    });

    expect(result).toBe(notification);
    expectEmittedToUser(ANOTHER_UUID, SOCKET_EVENTS.NOTIFICATION_CREATED, { notification });
  });

  it("never self-notifies", async () => {
    const result = await notify(db, mockIo, {
      userId: VALID_USER.id,
      actorId: VALID_USER.id,
      type: "TASK_ASSIGNED",
      message: "msg",
      entityId: VALID_TASK_ID,
      entityType: "task",
    });

    expect(result).toBeNull();
    expect(mockDb.notification.create).not.toHaveBeenCalled();
    expectNoEmit();
  });

  it("still notifies when there is no actor (system notification)", async () => {
    mockDb.notification.create.mockResolvedValueOnce(notification);

    await expect(
      notify(db, mockIo, {
        userId: VALID_USER.id,
        type: "TASK_UPDATED",
        message: "msg",
        entityId: VALID_TASK_ID,
        entityType: "task",
      }),
    ).resolves.toBe(notification);
  });
});

describe("buildNotificationMessage", () => {
  it.each([
    ["TASK_ASSIGNED", "Alice", "Ship it", 'Alice assigned you to "Ship it"'],
    ["TASK_ASSIGNED", "Alice", undefined, "Alice assigned you to a task"],
    ["TASK_UPDATED", "Alice", "Ship it", 'Alice updated "Ship it"'],
    ["TASK_UPDATED", "Alice", undefined, "Alice updated a task"],
    ["COMMENT_CREATED", "Alice", "Ship it", 'Alice commented on "Ship it"'],
    ["COMMENT_CREATED", "Alice", undefined, "Alice left a comment"],
    ["MEMBER_INVITED", "Alice", "Acme", 'Alice invited you to "Acme"'],
    ["MEMBER_INVITED", "Alice", undefined, "Alice invited you to an organization"],
    ["INVITATION_ACCEPTED", "Alice", "Acme", 'Alice accepted your invitation to "Acme"'],
    ["INVITATION_ACCEPTED", "Alice", undefined, "Alice accepted your invitation"],
    ["INVITATION_DECLINED", "Alice", "Acme", 'Alice declined your invitation to "Acme"'],
    ["INVITATION_DECLINED", "Alice", undefined, "Alice declined your invitation"],
    ["TASK_ASSIGNED", null, "Ship it", 'Someone assigned you to "Ship it"'],
    ["TASK_ASSIGNED", "Alice", "", "Alice assigned you to a task"],
  ] as [NotificationType, string | null, string | undefined, string][])(
    "%s / actor=%s / title=%s",
    (type, actor, title, expected) => {
      expect(buildNotificationMessage(type, actor, title)).toBe(expected);
    },
  );
});

describe("notifyTaskEvent", () => {
  const opts = {
    taskId: VALID_TASK_ID,
    taskTitle: "Ship it",
    actorId: VALID_USER.id,
  };

  it("is a no-op when there is no assignee", async () => {
    await notifyTaskEvent(db, mockIo, { ...opts, type: "TASK_ASSIGNED", recipientIds: [null] });

    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("falls back to 'Someone' when the actor account was deleted", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);
    mockDb.notification.create.mockResolvedValueOnce(notification);

    await notifyTaskEvent(db, mockIo, {
      ...opts,
      type: "TASK_ASSIGNED",
      recipientIds: [ANOTHER_UUID],
    });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: 'Someone assigned you to "Ship it"' }) as unknown,
      }),
    );
  });

  it.each([
    ["notifyTaskAssigned", notifyTaskAssigned, "TASK_ASSIGNED"],
    ["notifyCommentCreated", notifyCommentCreated, "COMMENT_CREATED"],
  ] as const)("%s sets type=%s", async (_name, fn, type) => {
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockDb.notification.create.mockResolvedValueOnce(notification);

    await fn(db, mockIo, { ...opts, assigneeId: ANOTHER_UUID, creatorId: null });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type,
          entityType: "task",
          entityId: VALID_TASK_ID,
        }) as unknown,
      }),
    );
  });
});

describe("notifyMemberInvited", () => {
  it("targets the invitee with an org-scoped notification", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockDb.notification.create.mockResolvedValueOnce(notification);

    await notifyMemberInvited(db, mockIo, {
      recipientId: ANOTHER_UUID,
      actorId: VALID_USER.id,
      orgId: VALID_ORG_ID,
      orgName: "Acme",
    });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ANOTHER_UUID,
          type: "MEMBER_INVITED",
          entityId: VALID_ORG_ID,
          entityType: "org",
          message: 'Alice invited you to "Acme"',
        }) as unknown,
      }),
    );
  });
});

describe("notifyInvitationResolved", () => {
  it("no-ops when the inviter's account was deleted (recipientId is null)", async () => {
    await notifyInvitationResolved(db, mockIo, {
      recipientId: null,
      actorId: ANOTHER_UUID,
      orgId: VALID_ORG_ID,
      orgName: "Acme",
      type: "INVITATION_ACCEPTED",
    });

    expect(mockDb.notification.create).not.toHaveBeenCalled();
    expectNoEmit();
  });

  it("notifies the original inviter when their invitation is accepted", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Bob" });
    mockDb.notification.create.mockResolvedValueOnce(notification);

    await notifyInvitationResolved(db, mockIo, {
      recipientId: VALID_USER.id,
      actorId: ANOTHER_UUID,
      orgId: VALID_ORG_ID,
      orgName: "Acme",
      type: "INVITATION_ACCEPTED",
    });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: VALID_USER.id,
          type: "INVITATION_ACCEPTED",
          entityId: VALID_ORG_ID,
          entityType: "org",
          message: 'Bob accepted your invitation to "Acme"',
        }) as unknown,
      }),
    );
  });

  it("notifies the original inviter when their invitation is declined", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Bob" });
    mockDb.notification.create.mockResolvedValueOnce(notification);

    await notifyInvitationResolved(db, mockIo, {
      recipientId: VALID_USER.id,
      actorId: ANOTHER_UUID,
      orgId: VALID_ORG_ID,
      orgName: "Acme",
      type: "INVITATION_DECLINED",
    });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "INVITATION_DECLINED" }) as unknown,
      }),
    );
  });
});
