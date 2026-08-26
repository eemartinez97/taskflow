import { beforeEach, describe, expect, it } from "vitest";

import { callerAs, clearEmitted } from "./setup/caller";
import { prisma, resetDb } from "./setup/db";
import { seedOrg, seedUser, seedWorkspace } from "./setup/seed";

beforeEach(async () => {
  await resetDb();
  clearEmitted();
});

describe("invitations end to end", () => {
  it("re-inviting after a decline leaves exactly one row, back to PENDING", async () => {
    const { owner, org } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob", email: "bob@example.com" });

    await callerAs(owner).invitations.create({
      orgId: org.id,
      data: { email: bob.email, role: "MEMBER" },
    });
    const firstInvitation = await prisma.invitation.findFirstOrThrow({
      where: { orgId: org.id, email: bob.email },
    });
    await callerAs(bob).invitations.decline({ invitationId: firstInvitation.id });

    await callerAs(owner).invitations.create({
      orgId: org.id,
      data: { email: bob.email, role: "ADMIN" },
    });

    const rows = await prisma.invitation.findMany({ where: { orgId: org.id, email: bob.email } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: firstInvitation.id, status: "PENDING", role: "ADMIN" });
  });

  it("the role<>'OWNER' CHECK constraint rejects a raw insert", async () => {
    const { org } = await seedWorkspace();

    await expect(
      prisma.invitation.create({
        data: {
          orgId: org.id,
          email: "owner-invite@example.com",
          role: "OWNER",
          tokenHash: "a".repeat(64),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
    ).rejects.toThrow();
  });

  it("two concurrent accepts of the same invitation create exactly one Membership", async () => {
    const { owner, org } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob", email: "bob-concurrent@example.com" });

    await callerAs(owner).invitations.create({
      orgId: org.id,
      data: { email: bob.email, role: "MEMBER" },
    });
    const invitation = await prisma.invitation.findFirstOrThrow({
      where: { orgId: org.id, email: bob.email },
    });

    const results = await Promise.allSettled([
      callerAs(bob).invitations.accept({ invitationId: invitation.id }),
      callerAs(bob).invitations.accept({ invitationId: invitation.id }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    await expect(
      prisma.membership.count({ where: { orgId: org.id, userId: bob.id } }),
    ).resolves.toBe(1);
  });

  it("deletes an org's invitations when the org itself is deleted (onDelete: Cascade)", async () => {
    const { owner, org } = await seedWorkspace();
    await callerAs(owner).invitations.create({
      orgId: org.id,
      data: { email: "x@example.com", role: "MEMBER" },
    });
    await expect(prisma.invitation.count({ where: { orgId: org.id } })).resolves.toBe(1);

    await callerAs(owner).orgs.delete({ orgId: org.id });

    await expect(prisma.invitation.count({ where: { orgId: org.id } })).resolves.toBe(0);
  });

  it("rejects revoking an invitation that belongs to a different org", async () => {
    const { owner: ownerA, org: orgA } = await seedWorkspace();
    const ownerB = await seedUser({ name: "Owner B" });
    const orgB = await seedOrg(ownerB.id, "Globex");

    await callerAs(ownerA).invitations.create({
      orgId: orgA.id,
      data: { email: "x@example.com", role: "MEMBER" },
    });
    const invitation = await prisma.invitation.findFirstOrThrow({ where: { orgId: orgA.id } });

    await expect(
      callerAs(ownerB).invitations.revoke({ orgId: orgB.id, invitationId: invitation.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects inviting an email that already has a still-active PENDING invitation to the same org", async () => {
    const { owner, org } = await seedWorkspace();

    await callerAs(owner).invitations.create({
      orgId: org.id,
      data: { email: "bob-dup@example.com", role: "MEMBER" },
    });

    await expect(
      callerAs(owner).invitations.create({
        orgId: org.id,
        data: { email: "bob-dup@example.com", role: "ADMIN" },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      prisma.invitation.count({ where: { orgId: org.id, email: "bob-dup@example.com" } }),
    ).resolves.toBe(1);
  });

  it("clears the invitee's stale MEMBER_INVITED notification on decline, so a later re-invite doesn't resurrect it", async () => {
    const { owner, org } = await seedWorkspace();
    const bob = await seedUser({ name: "Bob", email: "bob-notif@example.com" });
    await prisma.user.update({ where: { id: bob.id }, data: { emailVerified: new Date() } });

    await callerAs(owner).invitations.create({
      orgId: org.id,
      data: { email: bob.email, role: "MEMBER" },
    });
    const firstInvitation = await prisma.invitation.findFirstOrThrow({
      where: { orgId: org.id, email: bob.email },
    });
    await expect(
      prisma.notification.count({
        where: { userId: bob.id, type: "MEMBER_INVITED", entityId: org.id },
      }),
    ).resolves.toBe(1);

    await callerAs(bob).invitations.decline({ invitationId: firstInvitation.id });
    await expect(
      prisma.notification.count({
        where: { userId: bob.id, type: "MEMBER_INVITED", entityId: org.id },
      }),
    ).resolves.toBe(0);

    // A later re-invite creates its own fresh notification - it must not
    // find the declined cycle's (now-deleted) row and skip creating one.
    await callerAs(owner).invitations.create({
      orgId: org.id,
      data: { email: bob.email, role: "MEMBER" },
    });
    await expect(
      prisma.notification.count({
        where: { userId: bob.id, type: "MEMBER_INVITED", entityId: org.id },
      }),
    ).resolves.toBe(1);
  });
});
