import { beforeEach, describe, expect, it } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";

import { callerAs, clearEmitted, emitted } from "./setup/caller";
import { prisma, resetDb } from "./setup/db";
import { seedWorkspace } from "./setup/seed";

beforeEach(async () => {
  await resetDb();
  clearEmitted();
});

describe("project bootstrap", () => {
  it("creating a project seeds a board with the four Kanban columns", async () => {
    const { owner, org } = await seedWorkspace();

    const project = await callerAs(owner).projects.create({
      orgId: org.id,
      data: { name: "New", slug: "new", key: "NEW" },
    });

    const board = await prisma.board.findFirst({
      where: { projectId: project.id },
      include: { columns: { orderBy: { position: "asc" } } },
    });

    expect(board?.name).toBe("Main Board");
    expect(board?.columns.map((c) => c.name)).toEqual([
      "To Do",
      "In Progress",
      "In Review",
      "Done",
    ]);
    expect(board?.columns.map((c) => c.position)).toEqual([1000, 2000, 3000, 4000]);
  });
});

describe("task lifecycle", () => {
  it("appends tasks at the end of the column", async () => {
    const { owner, org, project, todo } = await seedWorkspace();
    const create = (title: string) =>
      callerAs(owner).tasks.create({
        orgId: org.id,
        projectId: project.id,
        data: { columnId: todo.id, title },
      });

    const first = await create("first");
    const second = await create("second");

    expect(second.position).toBeGreaterThan(first.position);
  });

  it("broadcasts task:created to the project room", async () => {
    const { owner, org, project, todo } = await seedWorkspace();

    await callerAs(owner).tasks.create({
      orgId: org.id,
      projectId: project.id,
      data: { columnId: todo.id, title: "Ship" },
    });

    expect(emitted).toContainEqual(
      expect.objectContaining({
        room: `project:${project.id}`,
        event: SOCKET_EVENTS.TASK_CREATED,
      }),
    );
  });

  it("moves a task between columns", async () => {
    const { owner, org, project, todo, done } = await seedWorkspace();
    const task = await callerAs(owner).tasks.create({
      orgId: org.id,
      projectId: project.id,
      data: { columnId: todo.id, title: "Ship" },
    });

    await callerAs(owner).tasks.move({
      orgId: org.id,
      projectId: project.id,
      payload: { taskId: task.id, targetColumnId: done.id, position: 500 },
    });

    await expect(prisma.task.findUnique({ where: { id: task.id } })).resolves.toMatchObject({
      columnId: done.id,
      position: 500,
    });
  });

  it("attaching the same label twice is idempotent", async () => {
    const { owner, org, project, todo } = await seedWorkspace();
    const task = await callerAs(owner).tasks.create({
      orgId: org.id,
      projectId: project.id,
      data: { columnId: todo.id, title: "Ship" },
    });
    const label = await callerAs(owner).labels.create({
      orgId: org.id,
      data: { name: "bug", color: "#EF4444" },
    });

    const input = { orgId: org.id, projectId: project.id, taskId: task.id, labelId: label.id };
    await callerAs(owner).tasks.addLabel(input);
    const labels = await callerAs(owner).tasks.addLabel(input);

    expect(labels).toHaveLength(1);
    await expect(prisma.taskLabel.count({ where: { taskId: task.id } })).resolves.toBe(1);
  });

  it("detaching a label that is not attached does not throw", async () => {
    const { owner, org, project, todo } = await seedWorkspace();
    const task = await callerAs(owner).tasks.create({
      orgId: org.id,
      projectId: project.id,
      data: { columnId: todo.id, title: "Ship" },
    });
    const label = await callerAs(owner).labels.create({
      orgId: org.id,
      data: { name: "bug", color: "#EF4444" },
    });

    await expect(
      callerAs(owner).tasks.removeLabel({
        orgId: org.id,
        projectId: project.id,
        taskId: task.id,
        labelId: label.id,
      }),
    ).resolves.toEqual([]);
  });
});

describe("referential integrity", () => {
  it("deleting a column cascades to its tasks", async () => {
    const { owner, org, project, todo } = await seedWorkspace();
    await callerAs(owner).tasks.create({
      orgId: org.id,
      projectId: project.id,
      data: { columnId: todo.id, title: "Ship" },
    });

    await callerAs(owner).boards.deleteColumn({ orgId: org.id, columnId: todo.id });

    await expect(prisma.task.count({ where: { columnId: todo.id } })).resolves.toBe(0);
  });

  it("deleting an org cascades to projects, boards and columns", async () => {
    const { owner, org, project } = await seedWorkspace();

    await callerAs(owner).orgs.delete({ orgId: org.id });

    await expect(prisma.project.count({ where: { id: project.id } })).resolves.toBe(0);
    await expect(prisma.board.count({ where: { projectId: project.id } })).resolves.toBe(0);
  });

  it("enforces one membership per (org, user)", async () => {
    const { owner, org } = await seedWorkspace();

    await expect(
      prisma.membership.create({ data: { orgId: org.id, userId: owner.id, role: "MEMBER" } }),
    ).rejects.toThrow();
  });
});
