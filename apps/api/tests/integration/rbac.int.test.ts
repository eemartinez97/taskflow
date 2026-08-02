import { beforeEach, describe, expect, it } from "vitest";

import { callerAs } from "./setup/caller";
import { resetDb } from "./setup/db";
import { seedMember, seedProject, seedUser, seedWorkspace } from "./setup/seed";

beforeEach(async () => {
  await resetDb();
});

describe("roleGuard against a real database", () => {
  it("resolves the caller's real membership role", async () => {
    const { owner, org } = await seedWorkspace();

    await expect(callerAs(owner).projects.list({ orgId: org.id })).resolves.toEqual([
      expect.objectContaining({ orgId: org.id }),
    ]);
  });

  it.each([
    ["OWNER", true],
    ["ADMIN", true],
    ["MEMBER", false],
  ] as const)("%s can delete a project: %s", async (role, allowed) => {
    const { org, project } = await seedWorkspace();
    const user = await seedUser();
    await seedMember(org.id, user.id, role);

    const call = callerAs(user).projects.delete({ orgId: org.id, projectId: project.id });

    if (allowed) await expect(call).resolves.toEqual({ success: true });
    else await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a user with no membership", async () => {
    const { org } = await seedWorkspace();
    const outsider = await seedUser();

    await expect(callerAs(outsider).projects.list({ orgId: org.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects anonymous callers before touching the database", async () => {
    const { org } = await seedWorkspace();

    await expect(callerAs(null).projects.list({ orgId: org.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// These only pass AFTER applying §4.2 (assertInputScopedToOrg).
describe("cross-tenant isolation", () => {
  it("cannot mutate a task that belongs to another organisation", async () => {
    const victim = await seedWorkspace();
    const victimTask = await seedProject(victim.org.id).then(() => victim.todo);

    const attacker = await seedUser();
    const attackerOrg = await seedWorkspace();
    await seedMember(attackerOrg.org.id, attacker.id, "OWNER");

    const task = await callerAs(victim.owner).tasks.create({
      orgId: victim.org.id,
      projectId: victim.project.id,
      data: { columnId: victimTask.id, title: "secret" },
    });

    await expect(
      callerAs(attacker).tasks.update({
        orgId: attackerOrg.org.id, // an org the attacker legitimately owns
        projectId: attackerOrg.project.id,
        taskId: task.id, // a task from the victim's org
        data: { title: "pwned" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cannot list members of an organisation it does not belong to", async () => {
    const { org } = await seedWorkspace();
    const outsider = await seedUser();

    await expect(callerAs(outsider).orgs.members({ orgId: org.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
