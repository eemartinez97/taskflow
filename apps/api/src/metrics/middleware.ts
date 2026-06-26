import type { NextFunction, Request, Response } from "express";
import { type AppCollectors } from "./collectors.js";

/**
 * Safely extracts the matched Express route path from req.route
 *
 * @types/express types `route` as `any`. Casting to `unknown` first and
 * narrowing manually avoids all `no-unsafe-member-access` violations while
 * preserving the correct runtime behavior.
 */
function getMatchedRoutePath(req: Request): string | null {
  // Cast from `any` => `unknown` before narrowing (never access `any` directly)
  const route: unknown = req.route;

  if (
    route !== null &&
    typeof route === "object" &&
    "path" in route &&
    typeof (route as Record<string, unknown>).path === "string"
  ) {
    return (route as { path: string }).path;
  }

  return null;
}

/**
 * Normalizes a request path for use as a Prometheus label.
 *
 * WITHOUT normalization every unique URL parameter creates a new label-set,
 * causing unbounded cardinality - a common Prometheus anti-pattern:
 *   /tasks/uuid-1 -> separate series from /tasks/uuid-2
 *
 * WITH normalization:
 *   /tasks/uuid-1    -> "/tasks/:taskId" (from Express matched route)
 *   /trpc/tasks.list -> "/trpc/:path"    (collapsed tRPC namespace)
 *   /unknown-path    -> "unknown"        (catch-all fallback)
 *
 * Express 5 populates `req.route.path` for matched routes.
 * For tRPC and unmatched routes it falls back to the collapsed path.
 */
export function normalizeRoute(req: Request): string {
  const matched = getMatchedRoutePath(req);
  if (matched !== null) return matched;

  const url = req.url;

  // Collapse all tRPC procedure calls into a single series to prevent
  // cardinality explosion - each procedure would otherwise be a unique label
  if (url.startsWith("/trpc")) return "/trpc/:path";

  // Health / readiness probes - preserve exact path for operational clarity
  if (url === "/healthz" || url === "/readyz") return url;

  // Fallback for unmatched routes (should only be the 404 catch-all)
  return "unknown";
}

/**
 * Express middleware that records per-request Prometheus metrics.
 *
 * Metrics recorded on each request:
 * - httpRequestsInProgress: gauge incremented on entry, decremented on finish
 * - httpRequestsTotal: counter incremented after response is sent
 * - httpRequestDurationSeconds: histogram observes total request latency
 *
 * Labels: method (GET/POST/...), route (normalized path), status_code (200/404/...)
 *
 * The `/metrics` endpoint itself is excluded to avoid inflating counts with
 * Prometheus scrape traffic - same pattern as health probe log suppression.
 *
 * Factory pattern: accepts collectors as a parameter for full testability.
 * Production code uses the `metricsMiddleware` singleton below.
 */
export function createMetricsMiddleware(collectors: AppCollectors) {
  return function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip the /metrics endpoint itself - scrape traffic should not inflate counts
    if (req.url === "/metrics") {
      next();
      return;
    }

    const method = req.method;

    collectors.httpRequestsInProgress.inc({ method });

    // Use process.hrtime.bigint for nanoseconds precision (avoids Date.now() drift)
    const startNs = process.hrtime.bigint();

    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1e9;
      const route = normalizeRoute(req);
      const statusCode = String(res.statusCode);

      collectors.httpRequestsInProgress.dec({ method });
      collectors.httpRequestsTotal.inc({ method, route, status_code: statusCode });
      collectors.httpRequestDurationSeconds.observe(
        { method, route, status_code: statusCode },
        durationSeconds,
      );
    });

    next();
  };
}
