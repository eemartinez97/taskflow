import { beforeEach, describe, expect, it } from "vitest";

import { callerAs, clearEmitted } from "./setup/caller";
import { prisma, resetDb } from "./setup/db";
import { seedMember, seedTask, seedUser, seedWorkspace } from "./setup/seed";

beforeEach(async () => {
  await resetDb();
  clearEmitted();
});

describe("leaving an organization", () => {
  it("removes the caller's own membership", async () => {
    const { org } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");

    await expect(callerAs(bob).orgs.leave({ orgId: org.id })).resolves.toEqual({ success: true });

    await expect(
      prisma.membership.findUnique({ where: { orgId_userId: { orgId: org.id, userId: bob.id } } }),
    ).resolves.toBeNull();
  });

  it("refuses to let the sole OWNER leave", async () => {
    const { owner, org } = await seedWorkspace();

    await expect(callerAs(owner).orgs.leave({ orgId: org.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await expect(
      prisma.membership.findUnique({
        where: { orgId_userId: { orgId: org.id, userId: owner.id } },
      }),
    ).resolves.not.toBeNull();
  });

  it("rejects leaving an org the caller does not belong to", async () => {
    const { org } = await seedWorkspace();
    const outsider = await seedUser({ name: "Outsider" });

    await expect(callerAs(outsider).orgs.leave({ orgId: org.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("preserves the departing member's task assignments instead of unassigning them", async () => {
    const { org, todo } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");
    const task = await seedTask(todo.id, { assigneeId: bob.id, title: "Bob's task" });

    await callerAs(bob).orgs.leave({ orgId: org.id });

    await expect(prisma.task.findUniqueOrThrow({ where: { id: task.id } })).resolves.toMatchObject({
      assigneeId: bob.id,
    });
  });

  it("surfaces the departing member's still-assigned tasks via formerAssignees", async () => {
    const { owner, org, todo } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");
    await seedTask(todo.id, { assigneeId: bob.id, title: "Bob's task" });

    await callerAs(bob).orgs.leave({ orgId: org.id });

    await expect(callerAs(owner).orgs.formerAssignees({ orgId: org.id })).resolves.toEqual([
      { id: bob.id, name: "Bob" },
    ]);
  });

  it("does not list a current member as a former assignee even if they hold tasks", async () => {
    const { owner, org, todo } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");
    await seedTask(todo.id, { assigneeId: bob.id, title: "Bob's task" });

    await expect(callerAs(owner).orgs.formerAssignees({ orgId: org.id })).resolves.toEqual([]);
  });

  it("notifies the OWNER with the stranded-task count when a member leaves", async () => {
    const { owner, org, todo } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");
    await seedTask(todo.id, { assigneeId: bob.id, title: "Task one" });
    await seedTask(todo.id, { assigneeId: bob.id, title: "Task two" });

    await callerAs(bob).orgs.leave({ orgId: org.id });

    const notifications = await prisma.notification.findMany({
      where: { userId: owner.id, type: "MEMBER_LEFT" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      actorId: bob.id,
      entityId: org.id,
      entityType: "org",
      message: expect.stringContaining("2 tasks need reassignment") as string,
    });
  });

  it("does not notify a member who left themselves, only the remaining OWNER/ADMIN", async () => {
    const { owner, org } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");

    await callerAs(bob).orgs.leave({ orgId: org.id });

    await expect(
      prisma.notification.findMany({ where: { userId: bob.id, type: "MEMBER_LEFT" } }),
    ).resolves.toEqual([]);
    await expect(
      prisma.notification.count({ where: { userId: owner.id, type: "MEMBER_LEFT" } }),
    ).resolves.toBe(1);
  });
});

describe("removing a member (admin-initiated)", () => {
  it("gives the removed member's tasks the same ex-member treatment as a voluntary leave", async () => {
    const { owner, org, todo } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob" });
    await seedMember(org.id, bob.id, "MEMBER");
    const task = await seedTask(todo.id, { assigneeId: bob.id, title: "Bob's task" });

    await callerAs(owner).orgs.removeMember({ orgId: org.id, userId: bob.id });

    await expect(prisma.task.findUniqueOrThrow({ where: { id: task.id } })).resolves.toMatchObject({
      assigneeId: bob.id,
    });
    await expect(callerAs(owner).orgs.formerAssignees({ orgId: org.id })).resolves.toEqual([
      { id: bob.id, name: "Bob" },
    ]);
    const notifications = await prisma.notification.findMany({
      where: { userId: owner.id, type: "MEMBER_LEFT" },
    });
    expect(notifications).toHaveLength(1);
  });
});

describe("cross-tenant isolation", () => {
  it("cannot see former assignees of an organisation it does not belong to", async () => {
    const { org } = await seedWorkspace();
    const outsider = await seedUser();

    await expect(callerAs(outsider).orgs.formerAssignees({ orgId: org.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
