/**
 * Prefix applied to every Prometheus metric name emitted by the API.
 * Single source of truth - import this instead of writing "taskflow_" inline.
 * Same pattern as SOCKET_ROOM_PREFIX
 */
export const METRICS_PREFIX = "taskflow_" as const;

/**
 * All Prometheus metric names emitted by apps/api.
 *
 * `satisfies Record<string, `${typeof METRICS_PREFIX}${string}`>` does two things:
 * 1. Preserves the literal type of each value (no widening to `string`).
 * 2. Enforces at compile-time that EVERY name starts with METRICS_PREFIX.
 *    Adding a new metric without the prefix is a type error - caught before runtime
 *
 * Same pattern as SOCKET_EVENTS: one object, one import, zero magic strings.
 */
export const METRIC_NAMES = {
  HTTP_REQUESTS_TOTAL: `${METRICS_PREFIX}http_requests_total`,
  HTTP_REQUEST_DURATION_SECONDS: `${METRICS_PREFIX}http_request_duration_seconds`,
  HTTP_REQUESTS_IN_PROGRESS: `${METRICS_PREFIX}http_requests_in_progress`,
  SOCKET_CONNECTED_CLIENTS: `${METRICS_PREFIX}socket_connected_clients`,
} as const satisfies Record<string, `${typeof METRICS_PREFIX}${string}`>;

/** Union type of all valid metric name strings. */
export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES];
