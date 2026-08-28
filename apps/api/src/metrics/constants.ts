/**
 * Prefix applied to every Prometheus metric name emitted by the API.
 * Single source of truth - import this instead of writing "taskflow_" inline.
 * Same pattern as SOCKET_ROOM_PREFIX
 */
export const METRICS_PREFIX = "taskflow_" as const;

/**
 * Metric names registered by collectors.ts's createCollectors - DB-free,
 * in-process-since-boot event counters (plus two pre-existing Gauges,
 * HTTP_REQUESTS_IN_PROGRESS and SOCKET_CONNECTED_CLIENTS, which are also
 * DB-free). Split from DB_GAUGE_NAMES below so each has its own testable
 * "these are exactly the names this factory registers" assertion - see
 * registry-and-collectors.test.ts / db-gauges.test.ts.
 *
 * `satisfies Record<string, `${typeof METRICS_PREFIX}${string}`>` does two things:
 * 1. Preserves the literal type of each value (no widening to `string`).
 * 2. Enforces at compile-time that EVERY name starts with METRICS_PREFIX.
 *    Adding a new metric without the prefix is a type error - caught before runtime
 *
 * Same pattern as SOCKET_EVENTS: one object, one import, zero magic strings.
 */
export const COLLECTOR_METRIC_NAMES = {
  HTTP_REQUESTS_TOTAL: `${METRICS_PREFIX}http_requests_total`,
  HTTP_REQUEST_DURATION_SECONDS: `${METRICS_PREFIX}http_request_duration_seconds`,
  HTTP_REQUESTS_IN_PROGRESS: `${METRICS_PREFIX}http_requests_in_progress`,
  SOCKET_CONNECTED_CLIENTS: `${METRICS_PREFIX}socket_connected_clients`,

  // -- Business/domain event counters --
  // Only ever go up - see DB_GAUGE_NAMES below for point-in-time totals.
  USERS_REGISTERED_TOTAL: `${METRICS_PREFIX}users_registered_total`,
  USERS_VERIFIED_TOTAL: `${METRICS_PREFIX}users_verified_total`,
  LOGIN_ATTEMPTS_TOTAL: `${METRICS_PREFIX}login_attempts_total`,
  PASSWORD_RESETS_REQUESTED_TOTAL: `${METRICS_PREFIX}password_resets_requested_total`,
  PASSWORD_RESETS_COMPLETED_TOTAL: `${METRICS_PREFIX}password_resets_completed_total`,

  ORGS_CREATED_TOTAL: `${METRICS_PREFIX}orgs_created_total`,
  ORG_MEMBERS_REMOVED_TOTAL: `${METRICS_PREFIX}org_members_removed_total`,

  PROJECTS_CREATED_TOTAL: `${METRICS_PREFIX}projects_created_total`,
  BOARDS_CREATED_TOTAL: `${METRICS_PREFIX}boards_created_total`,

  TASKS_CREATED_TOTAL: `${METRICS_PREFIX}tasks_created_total`,
  TASKS_DELETED_TOTAL: `${METRICS_PREFIX}tasks_deleted_total`,
  TASK_STATUS_CHANGES_TOTAL: `${METRICS_PREFIX}task_status_changes_total`,

  COMMENTS_CREATED_TOTAL: `${METRICS_PREFIX}comments_created_total`,
  LABELS_CREATED_TOTAL: `${METRICS_PREFIX}labels_created_total`,

  INVITATIONS_SENT_TOTAL: `${METRICS_PREFIX}invitations_sent_total`,
  INVITATIONS_RESENT_TOTAL: `${METRICS_PREFIX}invitations_resent_total`,
  INVITATIONS_RESOLVED_TOTAL: `${METRICS_PREFIX}invitations_resolved_total`,

  COLUMNS_CREATED_TOTAL: `${METRICS_PREFIX}columns_created_total`,
  COLUMNS_DELETED_TOTAL: `${METRICS_PREFIX}columns_deleted_total`,
  TASK_LABELS_ATTACHED_TOTAL: `${METRICS_PREFIX}task_labels_attached_total`,
  TASK_LABELS_DETACHED_TOTAL: `${METRICS_PREFIX}task_labels_detached_total`,
} as const satisfies Record<string, `${typeof METRICS_PREFIX}${string}`>;

/**
 * Metric names registered by db-gauges.ts's createDbGauges - point-in-time
 * "current total" snapshots, recomputed from the database on every scrape.
 * Deliberately separate from COLLECTOR_METRIC_NAMES's event counters, which
 * only ever go up and drift from the real row count the moment anything
 * gets deleted.
 */
export const DB_GAUGE_METRIC_NAMES = {
  USERS_TOTAL: `${METRICS_PREFIX}users_total`,
  // DAU-style (users seen in the last 24h via User.lastSeenAt) - NOT
  // concurrently-online, see COLLECTOR_METRIC_NAMES's SOCKET_CONNECTED_CLIENTS
  // for that.
  ACTIVE_USERS_TOTAL: `${METRICS_PREFIX}active_users_total`,
  ORGS_TOTAL: `${METRICS_PREFIX}orgs_total`,
  PROJECTS_TOTAL: `${METRICS_PREFIX}projects_total`,
  BOARDS_TOTAL: `${METRICS_PREFIX}boards_total`,
  TASKS_TOTAL: `${METRICS_PREFIX}tasks_total`,
  COMMENTS_TOTAL: `${METRICS_PREFIX}comments_total`,
  LABELS_TOTAL: `${METRICS_PREFIX}labels_total`,
  INVITATIONS_PENDING_TOTAL: `${METRICS_PREFIX}invitations_pending_total`,
} as const satisfies Record<string, `${typeof METRICS_PREFIX}${string}`>;

/** Every metric name emitted by apps/api - the union consumers usually want. */
export const METRIC_NAMES = { ...COLLECTOR_METRIC_NAMES, ...DB_GAUGE_METRIC_NAMES };

/** Union type of all valid metric name strings. */
export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES];
