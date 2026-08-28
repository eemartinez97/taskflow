import { Gauge, type Registry } from "prom-client";
import { prisma } from "@taskflow/database";
import { TASK_STATUSES } from "@taskflow/shared";
import { DB_GAUGE_METRIC_NAMES } from "./constants";
import { appRegistry } from "./registry";

/**
 * Point-in-time "current total" gauges, recomputed from the database on
 * every Prometheus scrape via prom-client's async `collect()` hook (called
 * from each metric's `.get()`, awaited before the registry reads its
 * values). Deliberately separate from collectors.ts's event counters:
 * those only ever go up (deletions never decrement them), so "orgs created
 * since boot" and "orgs that exist right now" are genuinely different
 * numbers - see BACKLOG.md's former Observability note on this gap. This
 * is the only file in metrics/ that talks to the database - collectors.ts
 * stays DB-free on purpose (its own docblock explains why: cheap, isolated
 * unit tests against a bare `new Registry()`).
 */

/**
 * DAU-style window for activeUsersTotal (User.lastSeenAt, written by
 * getSessionUser - see apps/api/src/utils/auth.ts). NOT concurrently-online
 * - that's socketConnectedClients, driven by live WebSocket presence.
 */
const ACTIVE_USER_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Sets an unlabeled gauge from a count query. `Promise.resolve(...)` wraps
 * the query defensively - in unit tests the Prisma mock's `.count()` isn't
 * always stubbed with a resolved value and returns `undefined` synchronously
 * (a real Prisma client always returns a genuine Promise), and `?? 0` covers
 * that same case so an unstubbed mock never sets the gauge to `undefined`.
 */
function setFromCount(gauge: Gauge, query: Promise<number | undefined>): Promise<void> {
  return Promise.resolve(query).then((count) => {
    gauge.set(count ?? 0);
  });
}

export interface DbGauges {
  usersTotal: Gauge;
  activeUsersTotal: Gauge;
  orgsTotal: Gauge;
  projectsTotal: Gauge;
  boardsTotal: Gauge;
  tasksTotal: Gauge<"status">;
  commentsTotal: Gauge;
  labelsTotal: Gauge;
  invitationsPendingTotal: Gauge;
}

/**
 * Factory mirroring collectors.ts's createCollectors - same
 * inject-a-Registry shape, so unit tests can construct an isolated instance
 * without touching the production appRegistry.
 */
export function createDbGauges(registry: Registry): DbGauges {
  const usersTotal = new Gauge({
    name: DB_GAUGE_METRIC_NAMES.USERS_TOTAL,
    help: "Current total number of user accounts",
    registers: [registry],
    collect() {
      return setFromCount(this, prisma.user.count());
    },
  });

  const activeUsersTotal = new Gauge({
    name: DB_GAUGE_METRIC_NAMES.ACTIVE_USERS_TOTAL,
    help: "Users active in the last 24h (User.lastSeenAt) - DAU-style, not concurrently-online",
    registers: [registry],
    collect() {
      return setFromCount(
        this,
        prisma.user.count({
          where: { lastSeenAt: { gte: new Date(Date.now() - ACTIVE_USER_WINDOW_MS) } },
        }),
      );
    },
  });

  const orgsTotal = new Gauge({
    name: DB_GAUGE_METRIC_NAMES.ORGS_TOTAL,
    help: "Current total number of organizations",
    registers: [registry],
    collect() {
      return setFromCount(this, prisma.org.count());
    },
  });

  const projectsTotal = new Gauge({
    name: DB_GAUGE_METRIC_NAMES.PROJECTS_TOTAL,
    help: "Current total number of projects",
    registers: [registry],
    collect() {
      return setFromCount(this, prisma.project.count());
    },
  });

  const boardsTotal = new Gauge({
    name: DB_GAUGE_METRIC_NAMES.BOARDS_TOTAL,
    help: "Current total number of boards",
    registers: [registry],
    collect() {
      return setFromCount(this, prisma.board.count());
    },
  });

  const tasksTotal = new Gauge<"status">({
    name: DB_GAUGE_METRIC_NAMES.TASKS_TOTAL,
    help: "Current total number of tasks, by status",
    labelNames: ["status"],
    registers: [registry],
    // Iterates the full fixed TaskStatus enum (5 members) rather than a DB
    // groupBy, so every status - including one with zero tasks right now -
    // always has a fresh value each scrape instead of a stale one (or a
    // missing series) lingering from a previous count.
    async collect() {
      const counts = await Promise.all(
        TASK_STATUSES.map((status) => Promise.resolve(prisma.task.count({ where: { status } }))),
      );
      TASK_STATUSES.forEach((status, i) => {
        this.set({ status }, counts[i] ?? 0);
      });
    },
  });

  const commentsTotal = new Gauge({
    name: DB_GAUGE_METRIC_NAMES.COMMENTS_TOTAL,
    help: "Current total number of task comments",
    registers: [registry],
    collect() {
      return setFromCount(this, prisma.comment.count());
    },
  });

  const labelsTotal = new Gauge({
    name: DB_GAUGE_METRIC_NAMES.LABELS_TOTAL,
    help: "Current total number of labels",
    registers: [registry],
    collect() {
      return setFromCount(this, prisma.label.count());
    },
  });

  const invitationsPendingTotal = new Gauge({
    name: DB_GAUGE_METRIC_NAMES.INVITATIONS_PENDING_TOTAL,
    help: "Current total number of PENDING org invitations",
    registers: [registry],
    collect() {
      return setFromCount(this, prisma.invitation.count({ where: { status: "PENDING" } }));
    },
  });

  return {
    usersTotal,
    activeUsersTotal,
    orgsTotal,
    projectsTotal,
    boardsTotal,
    tasksTotal,
    commentsTotal,
    labelsTotal,
    invitationsPendingTotal,
  };
}

/** Production singleton - backed by appRegistry, same pattern as collectors.ts's appCollectors. */
export const dbGauges = createDbGauges(appRegistry);
