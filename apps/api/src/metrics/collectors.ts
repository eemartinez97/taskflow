import { Counter, Gauge, Histogram, type Registry } from "prom-client";
import { COLLECTOR_METRIC_NAMES } from "./constants";
import { appRegistry } from "./registry";

// Type exports

export interface HttpRequestLabels {
  method: string;
  route: string;
  status_code: string;
}

/** All application-level metric instances bundled together. */
export interface AppCollectors {
  httpRequestsTotal: Counter<keyof HttpRequestLabels>;
  httpRequestDurationSeconds: Histogram<keyof HttpRequestLabels>;
  httpRequestsInProgress: Gauge<"method">;
  socketConnectedClients: Gauge;

  // -- Business/domain metrics --
  usersRegisteredTotal: Counter;
  usersVerifiedTotal: Counter;
  loginAttemptsTotal: Counter<"outcome">;
  passwordResetsRequestedTotal: Counter;
  passwordResetsCompletedTotal: Counter;

  orgsCreatedTotal: Counter;
  orgMembersRemovedTotal: Counter<"reason">;

  projectsCreatedTotal: Counter;
  boardsCreatedTotal: Counter;

  tasksCreatedTotal: Counter;
  tasksDeletedTotal: Counter;
  taskStatusChangesTotal: Counter<"to_status">;

  commentsCreatedTotal: Counter;
  labelsCreatedTotal: Counter;

  invitationsSentTotal: Counter;
  invitationsResentTotal: Counter;
  invitationsResolvedTotal: Counter<"status">;

  columnsCreatedTotal: Counter;
  columnsDeletedTotal: Counter;
  taskLabelsAttachedTotal: Counter;
  taskLabelsDetachedTotal: Counter;
}

/**
 * Factory that creates all application metrics registered against
 * the provider Registry
 *
 * WHY a factory (not module-level singletons):
 * - Each unit test can call createCollectors(new Registry()) and get a
 *   completely isolated set of metrics - no cross-test pollution.
 * - Production code calls this once with `appRegistry` via the
 *   module-level `appCollectors` export below.
 */
export function createCollectors(registry: Registry): AppCollectors {
  const httpRequestsTotal = new Counter<keyof HttpRequestLabels>({
    name: COLLECTOR_METRIC_NAMES.HTTP_REQUESTS_TOTAL,
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  });

  const httpRequestDurationSeconds = new Histogram<keyof HttpRequestLabels>({
    name: COLLECTOR_METRIC_NAMES.HTTP_REQUEST_DURATION_SECONDS,
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    // Buckets cover sub-ms API responses through slow DB queries
    buckets: [0.005, 0.01, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const httpRequestsInProgress = new Gauge<"method">({
    name: COLLECTOR_METRIC_NAMES.HTTP_REQUESTS_IN_PROGRESS,
    help: "Number of HTTP requests currently being processed",
    labelNames: ["method"],
    registers: [registry],
  });

  const socketConnectedClients = new Gauge<string>({
    name: COLLECTOR_METRIC_NAMES.SOCKET_CONNECTED_CLIENTS,
    help: "Number of Socket.IO clients currently connected",
    labelNames: [],
    registers: [registry],
  });

  // -- Business/domain metrics --
  // Plain event counters, incremented at the point of the domain event in
  // each module's service.ts (same singleton-import pattern socket/server.ts
  // already uses for socketConnectedClients). "New today/this week" etc. is
  // a Prometheus/Grafana query concern (increase()/rate() over the counter),
  // not something computed here - see COLLECTOR_METRIC_NAMES's docblock.

  const usersRegisteredTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.USERS_REGISTERED_TOTAL,
    help: "Total number of new (unverified) user accounts created",
    registers: [registry],
  });

  const usersVerifiedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.USERS_VERIFIED_TOTAL,
    help: "Total number of user accounts that completed email verification",
    registers: [registry],
  });

  const loginAttemptsTotal = new Counter<"outcome">({
    name: COLLECTOR_METRIC_NAMES.LOGIN_ATTEMPTS_TOTAL,
    help: "Total number of login attempts, by outcome",
    labelNames: ["outcome"],
    registers: [registry],
  });

  const passwordResetsRequestedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.PASSWORD_RESETS_REQUESTED_TOTAL,
    help: "Total number of password reset emails sent to a verified account",
    registers: [registry],
  });

  const passwordResetsCompletedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.PASSWORD_RESETS_COMPLETED_TOTAL,
    help: "Total number of passwords successfully reset via an emailed token",
    registers: [registry],
  });

  const orgsCreatedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.ORGS_CREATED_TOTAL,
    help: "Total number of organizations created",
    registers: [registry],
  });

  const orgMembersRemovedTotal = new Counter<"reason">({
    name: COLLECTOR_METRIC_NAMES.ORG_MEMBERS_REMOVED_TOTAL,
    help: "Total number of organization memberships removed, by reason",
    labelNames: ["reason"],
    registers: [registry],
  });

  const projectsCreatedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.PROJECTS_CREATED_TOTAL,
    help: "Total number of projects created",
    registers: [registry],
  });

  const boardsCreatedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.BOARDS_CREATED_TOTAL,
    help: "Total number of boards created",
    registers: [registry],
  });

  const tasksCreatedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.TASKS_CREATED_TOTAL,
    help: "Total number of tasks created",
    registers: [registry],
  });

  const tasksDeletedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.TASKS_DELETED_TOTAL,
    help: "Total number of tasks deleted",
    registers: [registry],
  });

  const taskStatusChangesTotal = new Counter<"to_status">({
    name: COLLECTOR_METRIC_NAMES.TASK_STATUS_CHANGES_TOTAL,
    help: "Total number of task status transitions, by resulting status",
    labelNames: ["to_status"],
    registers: [registry],
  });

  const commentsCreatedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.COMMENTS_CREATED_TOTAL,
    help: "Total number of task comments created",
    registers: [registry],
  });

  const labelsCreatedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.LABELS_CREATED_TOTAL,
    help: "Total number of labels created",
    registers: [registry],
  });

  const invitationsSentTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.INVITATIONS_SENT_TOTAL,
    help: "Total number of org invitations sent",
    registers: [registry],
  });

  const invitationsResentTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.INVITATIONS_RESENT_TOTAL,
    help: "Total number of org invitations re-sent",
    registers: [registry],
  });

  const invitationsResolvedTotal = new Counter<"status">({
    name: COLLECTOR_METRIC_NAMES.INVITATIONS_RESOLVED_TOTAL,
    help: "Total number of org invitations resolved, by resulting status",
    labelNames: ["status"],
    registers: [registry],
  });

  const columnsCreatedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.COLUMNS_CREATED_TOTAL,
    help: "Total number of board columns created",
    registers: [registry],
  });

  const columnsDeletedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.COLUMNS_DELETED_TOTAL,
    help: "Total number of board columns deleted",
    registers: [registry],
  });

  const taskLabelsAttachedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.TASK_LABELS_ATTACHED_TOTAL,
    help: "Total number of label-to-task attachments",
    registers: [registry],
  });

  const taskLabelsDetachedTotal = new Counter({
    name: COLLECTOR_METRIC_NAMES.TASK_LABELS_DETACHED_TOTAL,
    help: "Total number of label-to-task detachments",
    registers: [registry],
  });

  return {
    httpRequestsTotal,
    httpRequestDurationSeconds,
    httpRequestsInProgress,
    socketConnectedClients,
    usersRegisteredTotal,
    usersVerifiedTotal,
    loginAttemptsTotal,
    passwordResetsRequestedTotal,
    passwordResetsCompletedTotal,
    orgsCreatedTotal,
    orgMembersRemovedTotal,
    projectsCreatedTotal,
    boardsCreatedTotal,
    tasksCreatedTotal,
    tasksDeletedTotal,
    taskStatusChangesTotal,
    commentsCreatedTotal,
    labelsCreatedTotal,
    invitationsSentTotal,
    invitationsResentTotal,
    invitationsResolvedTotal,
    columnsCreatedTotal,
    columnsDeletedTotal,
    taskLabelsAttachedTotal,
    taskLabelsDetachedTotal,
  };
}

/** Production singleton - backed by appRegistry */
export const appCollectors = createCollectors(appRegistry);
