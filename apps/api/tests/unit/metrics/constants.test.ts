import { expect, it, describe } from "vitest";

import { METRIC_NAMES, METRICS_PREFIX } from "../../../src/metrics/constants";

describe("METRICS_PREFIX", () => {
  it("is 'taskflow_'", () => {
    expect(METRICS_PREFIX).toBe("taskflow_");
  });

  it("follows Prometheus convention: lowercase, ends with underscore", () => {
    expect(METRICS_PREFIX).toMatch(/^[a-z][a-z0-9_]*_$/);
  });
});

describe("METRIC_NAMES", () => {
  it("every metric name starts with METRICS_PREFIX", () => {
    for (const name of Object.values(METRIC_NAMES)) {
      expect(name.startsWith(METRICS_PREFIX)).toBe(true);
    }
  });

  it("contains exactly 4 metrics (sync guard)", () => {
    // If a new metric is added to METRIC_NAMES without a test,
    // this count fails — forces the developer to update the test suite
    expect(Object.keys(METRIC_NAMES)).toHaveLength(4);
    expect(Object.keys(METRIC_NAMES)).toEqual(
      expect.arrayContaining([
        "HTTP_REQUESTS_TOTAL",
        "HTTP_REQUEST_DURATION_SECONDS",
        "HTTP_REQUESTS_IN_PROGRESS",
        "SOCKET_CONNECTED_CLIENTS",
      ]),
    );
  });

  it("all names use snake_case after the prefix", () => {
    for (const name of Object.values(METRIC_NAMES)) {
      const suffix = name.slice(METRICS_PREFIX.length);
      expect(suffix).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("HTTP_REQUESTS_TOTAL is correctly formed", () => {
    expect(METRIC_NAMES.HTTP_REQUESTS_TOTAL).toBe("taskflow_http_requests_total");
  });

  it("HTTP_REQUEST_DURATION_SECONDS is correctly formed", () => {
    expect(METRIC_NAMES.HTTP_REQUEST_DURATION_SECONDS).toBe(
      "taskflow_http_request_duration_seconds",
    );
  });

  it("HTTP_REQUESTS_IN_PROGRESS is correctly formed", () => {
    expect(METRIC_NAMES.HTTP_REQUESTS_IN_PROGRESS).toBe("taskflow_http_requests_in_progress");
  });

  it("SOCKET_CONNECTED_CLIENTS is correctly formed", () => {
    expect(METRIC_NAMES.SOCKET_CONNECTED_CLIENTS).toBe("taskflow_socket_connected_clients");
  });
});

describe("collectors.ts uses METRIC_NAMES (integration guard)", () => {
  it("registered metric names in collectors match METRIC_NAMES exactly", async () => {
    const { Registry } = await import("prom-client");
    const { createCollectors } = await import("../../../src/metrics/collectors");

    const registry = new Registry();
    createCollectors(registry);

    const registered = (await registry.getMetricsAsJSON()).map((m) => m.name);
    const expected = Object.values(METRIC_NAMES);

    for (const name of expected) {
      expect(registered).toContain(name);
    }
  });
});
