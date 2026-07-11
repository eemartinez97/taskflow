import { Counter, Gauge, Histogram, type Registry } from "prom-client";
import { METRIC_NAMES } from "./constants";

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
    name: METRIC_NAMES.HTTP_REQUESTS_TOTAL,
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  });

  const httpRequestDurationSeconds = new Histogram<keyof HttpRequestLabels>({
    name: METRIC_NAMES.HTTP_REQUEST_DURATION_SECONDS,
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    // Buckets cover sub-ms API responses through slow DB queries
    buckets: [0.005, 0.01, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const httpRequestsInProgress = new Gauge<"method">({
    name: METRIC_NAMES.HTTP_REQUESTS_IN_PROGRESS,
    help: "Number of HTTP requests currently being processed",
    labelNames: ["method"],
    registers: [registry],
  });

  const socketConnectedClients = new Gauge<string>({
    name: METRIC_NAMES.SOCKET_CONNECTED_CLIENTS,
    help: "Number of Socket.IO clients currently connected",
    labelNames: [],
    registers: [registry],
  });

  return {
    httpRequestsTotal,
    httpRequestDurationSeconds,
    httpRequestsInProgress,
    socketConnectedClients,
  };
}

/** Production singleton - backed by appRegistry */
export const appCollectors = createCollectors(
  // Lazy import avoids a circular dependency between registry and collectors
  // Both are initialized at module load; ES module import order guarantees
  // appRegistry is ready before appCollectors is created
  (await import("./registry")).appRegistry,
);
