import { describe, expect, it } from "vitest";
import { Registry } from "prom-client";

import { createDbGauges, dbGauges } from "../../../src/metrics/db-gauges";
import { DB_GAUGE_METRIC_NAMES } from "../../../src/metrics/constants";
import { appRegistry } from "../../../src/metrics/registry";
import { mockDb } from "../../mocks/database-mock";

describe("createDbGauges", () => {
  it("registers all nine gauges on the given registry", async () => {
    const registry = new Registry();
    createDbGauges(registry);

    const names = (await registry.getMetricsAsJSON()).map((m) => m.name);
    expect(names).toEqual(expect.arrayContaining(Object.values(DB_GAUGE_METRIC_NAMES)));
  });

  it("isolates registries: two instances never collide", () => {
    expect(() => {
      createDbGauges(new Registry());
      createDbGauges(new Registry());
    }).not.toThrow();
  });

  it("exposes a production singleton bound to appRegistry", () => {
    expect(dbGauges.usersTotal).toBeDefined();
    expect(appRegistry.getSingleMetric(DB_GAUGE_METRIC_NAMES.USERS_TOTAL)).toBe(
      dbGauges.usersTotal,
    );
  });

  it("usersTotal reflects prisma.user.count() on scrape", async () => {
    const registry = new Registry();
    const gauges = createDbGauges(registry);
    mockDb.user.count.mockResolvedValueOnce(7);

    const value = (await gauges.usersTotal.get()).values[0]?.value;
    expect(value).toBe(7);
  });

  it("activeUsersTotal queries with a 24h lastSeenAt window", async () => {
    const registry = new Registry();
    const gauges = createDbGauges(registry);
    mockDb.user.count.mockResolvedValueOnce(3);

    const value = (await gauges.activeUsersTotal.get()).values[0]?.value;
    expect(value).toBe(3);
    expect(mockDb.user.count).toHaveBeenCalledWith({
      where: { lastSeenAt: { gte: expect.any(Date) as Date } },
    });
  });

  it("orgsTotal/projectsTotal/boardsTotal/commentsTotal/labelsTotal each reflect their own count()", async () => {
    const registry = new Registry();
    const gauges = createDbGauges(registry);
    mockDb.org.count.mockResolvedValueOnce(1);
    mockDb.project.count.mockResolvedValueOnce(2);
    mockDb.board.count.mockResolvedValueOnce(3);
    mockDb.comment.count.mockResolvedValueOnce(4);
    mockDb.label.count.mockResolvedValueOnce(5);

    await expect(gauges.orgsTotal.get().then((m) => m.values[0]?.value)).resolves.toBe(1);
    await expect(gauges.projectsTotal.get().then((m) => m.values[0]?.value)).resolves.toBe(2);
    await expect(gauges.boardsTotal.get().then((m) => m.values[0]?.value)).resolves.toBe(3);
    await expect(gauges.commentsTotal.get().then((m) => m.values[0]?.value)).resolves.toBe(4);
    await expect(gauges.labelsTotal.get().then((m) => m.values[0]?.value)).resolves.toBe(5);
  });

  it("invitationsPendingTotal counts only PENDING invitations", async () => {
    const registry = new Registry();
    const gauges = createDbGauges(registry);
    mockDb.invitation.count.mockResolvedValueOnce(2);

    const value = (await gauges.invitationsPendingTotal.get()).values[0]?.value;
    expect(value).toBe(2);
    expect(mockDb.invitation.count).toHaveBeenCalledWith({ where: { status: "PENDING" } });
  });

  it("tasksTotal sets one series per TaskStatus, labeled by status", async () => {
    const registry = new Registry();
    const gauges = createDbGauges(registry);
    mockDb.task.count
      .mockResolvedValueOnce(1) // TODO
      .mockResolvedValueOnce(2) // IN_PROGRESS
      .mockResolvedValueOnce(3) // IN_REVIEW
      .mockResolvedValueOnce(4) // DONE
      .mockResolvedValueOnce(5); // CANCELLED

    const values = (await gauges.tasksTotal.get()).values;
    expect(values).toEqual([
      expect.objectContaining({ labels: { status: "TODO" }, value: 1 }),
      expect.objectContaining({ labels: { status: "IN_PROGRESS" }, value: 2 }),
      expect.objectContaining({ labels: { status: "IN_REVIEW" }, value: 3 }),
      expect.objectContaining({ labels: { status: "DONE" }, value: 4 }),
      expect.objectContaining({ labels: { status: "CANCELLED" }, value: 5 }),
    ]);
  });

  it("defaults to 0 when a count query resolves to a nullish value", async () => {
    const registry = new Registry();
    const gauges = createDbGauges(registry);
    // Simulates an unstubbed mock (resolves to undefined) rather than a real count.
    mockDb.org.count.mockResolvedValueOnce(undefined);

    const value = (await gauges.orgsTotal.get()).values[0]?.value;
    expect(value).toBe(0);
  });
});
