import { Registry, collectDefaultMetrics } from "prom-client";
import { METRICS_PREFIX } from "./constants";

/**
 * Application-wide Prometheus registry
 *
 * A dedicated Registry (not the prom-client global default) avoids
 * state leakage between tests and makes the registry injectable.
 *
 * `collectDefaultMetrics` is called once here at module initialization.
 * It registers CPU, memory, event-loop lag, GC and file-descriptor metrics.
 * Metrics are collected on each scrape - no polling interval.
 */

const registry = new Registry();

collectDefaultMetrics({ register: registry, prefix: METRICS_PREFIX });

export { registry as appRegistry };
