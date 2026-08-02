import { describe, expect, it } from "vitest";
import { Registry } from "prom-client";

import { appCollectors, createCollectors } from "../../../src/metrics/collectors";
import { METRIC_NAMES } from "../../../src/metrics/constants";
import { appRegistry } from "../../../src/metrics/registry";
import { makeTestCollectors } from "../../helpers";

describe("appRegistry", () => {
  it("is a dedicated Registry, not prom-client's global default", () => {
    expect(appRegistry).toBeInstanceOf(Registry);
  });

  it("collects default process metrics under the app prefix", async () => {
    const output = await appRegistry.metrics();

    expect(output).toContain("taskflow_process_cpu_user_seconds_total");
  });
});

describe("createCollectors", () => {
  it("registers all four application metrics on the given registry", async () => {
    const { registry } = makeTestCollectors();
    const names = (await registry.getMetricsAsJSON()).map((m) => m.name);

    expect(names).toEqual(expect.arrayContaining(Object.values(METRIC_NAMES)));
  });

  it("isolates registries: two instances never collide", () => {
    const a = new Registry();
    const b = new Registry();

    expect(() => {
      createCollectors(a);
      createCollectors(b);
    }).not.toThrow();
  });

  it("declares the documented label names", async () => {
    const { collectors, registry } = makeTestCollectors();

    collectors.httpRequestsTotal.inc({ method: "GET", route: "/healthz", status_code: "200" });
    collectors.httpRequestsInProgress.inc({ method: "GET" });
    collectors.socketConnectedClients.inc();

    const json = await registry.getMetricsAsJSON();
    const total = json.find((m) => m.name === METRIC_NAMES.HTTP_REQUESTS_TOTAL);

    expect(total?.values[0]?.labels).toEqual({
      method: "GET",
      route: "/healthz",
      status_code: "200",
    });
  });

  it("uses buckets that cover sub-ms responses through slow queries", async () => {
    const { collectors, registry } = makeTestCollectors();

    collectors.httpRequestDurationSeconds.observe(
      { method: "GET", route: "/trpc/:path", status_code: "200" },
      0.003,
    );

    const json = await registry.getMetricsAsJSON();
    const histogram = json.find((m) => m.name === METRIC_NAMES.HTTP_REQUEST_DURATION_SECONDS);
    const buckets =
      histogram?.values.filter(
        (v) => (v.labels as Record<string, string | undefined>).le !== undefined,
      ) ?? [];

    expect(buckets.some((b) => b.labels.le === 0.005)).toBe(true);
  });

  it("exposes a production singleton bound to appRegistry", () => {
    expect(appCollectors.httpRequestsTotal).toBeDefined();
    expect(appRegistry.getSingleMetric(METRIC_NAMES.HTTP_REQUESTS_TOTAL)).toBe(
      appCollectors.httpRequestsTotal,
    );
  });
});
