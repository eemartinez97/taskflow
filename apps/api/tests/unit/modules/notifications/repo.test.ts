import { describe } from "vitest";

import {
  countUnread,
  createNotification,
  deleteNotification,
  findNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationsAsRead,
} from "../../../../src/modules/notifications/repo";
import { buildNotificationWithActor } from "../../../factories";
import { notificationWithActor } from "../../../mocks/database-mock";
import { db, VALID_TASK_ID, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { itDelegatesToPrisma } from "../../../support/repo-contract";

describe("notifications repo", () => {
  itDelegatesToPrisma([
    {
      name: "findNotificationsForUser caps at 50, newest first",
      delegate: mockDb.notification.findMany,
      resolves: [buildNotificationWithActor()],
      call: () => findNotificationsForUser(db, VALID_USER.id),
      args: {
        where: { userId: VALID_USER.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: notificationWithActor,
      },
    },
    {
      name: "createNotification strips undefined",
      delegate: mockDb.notification.create,
      resolves: buildNotificationWithActor(),
      call: () =>
        createNotification(db, {
          userId: VALID_USER.id,
          actorId: undefined,
          type: "TASK_ASSIGNED",
          message: "msg",
          entityId: VALID_TASK_ID,
          entityType: "task",
        }),
      args: {
        data: {
          userId: VALID_USER.id,
          type: "TASK_ASSIGNED",
          message: "msg",
          entityId: VALID_TASK_ID,
          entityType: "task",
        },
        include: notificationWithActor,
      },
    },
    {
      name: "markNotificationsAsRead scopes to the owner",
      delegate: mockDb.notification.updateMany,
      resolves: { count: 2 },
      call: () => markNotificationsAsRead(db, VALID_USER.id, ["n1", "n2"]),
      args: { where: { id: { in: ["n1", "n2"] }, userId: VALID_USER.id }, data: { read: true } },
    },
    {
      name: "markAllNotificationsAsRead only touches unread rows",
      delegate: mockDb.notification.updateMany,
      resolves: { count: 5 },
      call: () => markAllNotificationsAsRead(db, VALID_USER.id),
      args: { where: { userId: VALID_USER.id, read: false }, data: { read: true } },
    },
    {
      name: "deleteNotification scopes to the owner",
      delegate: mockDb.notification.delete,
      resolves: {},
      call: () => deleteNotification(db, "n1", VALID_USER.id),
      args: { where: { id: "n1", userId: VALID_USER.id } },
      returns: undefined,
    },
    {
      name: "countUnread",
      delegate: mockDb.notification.count,
      resolves: 3,
      call: () => countUnread(db, VALID_USER.id),
      args: { where: { userId: VALID_USER.id, read: false } },
    },
  ]);
});
