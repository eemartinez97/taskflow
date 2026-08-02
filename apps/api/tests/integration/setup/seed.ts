import { randomUUID } from "node:crypto";
import type { Board, Column, Membership, Org, Project, Role, Task, User } from "@taskflow/database";

import { prisma } from "./db";

export async function seedUser(overrides: { email?: string; name?: string } = {}): Promise<User> {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `${randomUUID()}@example.com`,
      name: overrides.name ?? "Test User",
    },
  });
}

/** Creates an org whose OWNER is `ownerId`. */
export async function seedOrg(ownerId: string, name = "Acme"): Promise<Org> {
  return prisma.org.create({
    data: {
      name,
      slug: `${name.toLowerCase()}-${randomUUID().slice(0, 8)}`,
      memberships: { create: { userId: ownerId, role: "OWNER" } },
    },
  });
}

export async function seedMember(orgId: string, userId: string, role: Role): Promise<Membership> {
  return prisma.membership.create({ data: { orgId, userId, role } });
}

/** Project + board + the four default columns, mirroring createDefaultBoard. */
export async function seedProject(
  orgId: string,
  name = "Website",
  key = `WEB-${randomUUID().slice(0, 6).toUpperCase()}`,
  slug = `website-${randomUUID().slice(0, 8)}`,
): Promise<{ project: Project; board: Board; columns: Column[] }> {
  const project = await prisma.project.create({ data: { orgId, name, key, slug } });
  const board = await prisma.board.create({ data: { projectId: project.id, name: "Main Board" } });

  const columns = await Promise.all(
    [
      { name: "To Do", position: 1000 },
      { name: "In Progress", position: 2000 },
      { name: "In Review", position: 3000 },
      { name: "Done", position: 4000 },
    ].map((c) => prisma.column.create({ data: { boardId: board.id, ...c } })),
  );

  return { project, board, columns };
}

export async function seedTask(
  columnId: string,
  overrides: Record<string, unknown> = {},
): Promise<Task> {
  return prisma.task.create({
    data: { columnId, title: "Ship it", position: 1000, ...overrides },
  });
}

/** Full fixture: owner + org + project + board + columns. */
export async function seedWorkspace(): Promise<{
  owner: User;
  org: Org;
  project: Project;
  board: Board;
  columns: Column[];
  todo: Column;
  done: Column;
}> {
  const owner = await seedUser({ name: "Olivia Owner" });
  const org = await seedOrg(owner.id);
  const { project, board, columns } = await seedProject(org.id);

  const todo = columns[0];
  const done = columns[3];

  if (!todo || !done) {
    throw new Error("Failed to seed default columns");
  }

  return { owner, org, project, board, columns, todo, done };
}
