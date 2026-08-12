import { beforeEach, describe, expect, it, vi } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";

import { callerAs, clearEmitted, emitted } from "./setup/caller";
import { prisma, resetDb } from "./setup/db";
import { seedMember, seedUser, seedWorkspace } from "./setup/seed";

beforeEach(async () => {
  await resetDb();
  clearEmitted();
});

describe("notifications end to end", () => {
  it("notifies the assignee and pushes to their personal room", async () => {
    const { owner, org, project, todo } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");

    await callerAs(owner).tasks.create({
      orgId: org.id,
      projectId: project.id,
      data: { columnId: todo.id, title: "Ship it", assigneeId: bob.id },
    });

    // notifyTaskAssigned now runs fire-and-forget (see tasks/service.ts) so
    // tasks.create's own response doesn't wait behind it.
    await vi.waitFor(async () => {
      const { notifications, unreadCount } = await callerAs(bob).notifications.list();
      expect(unreadCount).toBe(1);
      expect(notifications[0]).toMatchObject({
        type: "TASK_ASSIGNED",
        message: 'Olivia Owner assigned you to "Ship it"',
        read: false,
      });
    });
    expect(emitted).toContainEqual(
      expect.objectContaining({
        room: `user:${bob.id}`,
        event: SOCKET_EVENTS.NOTIFICATION_CREATED,
      }),
    );
  });

  it("never notifies you about your own actions", async () => {
    const { owner, org, project, todo } = await seedWorkspace();

    await callerAs(owner).tasks.create({
      orgId: org.id,
      projectId: project.id,
      data: { columnId: todo.id, title: "Mine", assigneeId: owner.id },
    });

    await expect(callerAs(owner).notifications.list()).resolves.toMatchObject({ unreadCount: 0 });
  });

  it("markAllRead only touches the caller's rows", async () => {
    const { owner, org, project, todo } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");

    const task = await callerAs(owner).tasks.create({
      orgId: org.id,
      projectId: project.id,
      data: { columnId: todo.id, title: "Ship it", assigneeId: bob.id },
    });

    await callerAs(bob).comments.create({
      orgId: org.id,
      projectId: project.id,
      taskId: task.id,
      body: "on it",
    });

    // notifyTaskAssigned/notifyCommentCreated now run fire-and-forget (see
    // tasks/service.ts, comments/service.ts) - wait for both notifications
    // to actually land before marking them read, or markAllRead could race
    // ahead of the write it's meant to consume.
    await vi.waitFor(async () => {
      expect(await prisma.notification.count({ where: { userId: bob.id } })).toBe(1);
      expect(await prisma.notification.count({ where: { userId: owner.id } })).toBe(1);
    });

    // bob marks his own notifications as read
    await expect(callerAs(bob).notifications.markAllRead()).resolves.toEqual({ count: 1 });

    // bob's notifications are now all read
    await expect(
      prisma.notification.count({ where: { userId: bob.id, read: false } }),
    ).resolves.toBe(0);

    // owner's notification is untouched - this is the actual isolation check
    await expect(
      prisma.notification.count({ where: { userId: owner.id, read: false } }),
    ).resolves.toBe(1);
  });

  it("cannot delete someone else's notification", async () => {
    const { owner, org, project, todo } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");

    await callerAs(owner).tasks.create({
      orgId: org.id,
      projectId: project.id,
      data: { columnId: todo.id, title: "Ship it", assigneeId: bob.id },
    });

    let notificationId = "";
    await vi.waitFor(async () => {
      const { notifications } = await callerAs(bob).notifications.list();
      expect(notifications).toHaveLength(1);
      notificationId = notifications[0]?.id ?? "";
    });

    await expect(callerAs(owner).notifications.delete({ notificationId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
