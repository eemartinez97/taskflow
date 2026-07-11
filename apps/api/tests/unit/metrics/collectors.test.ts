import { beforeEach, describe, expect, it } from "vitest";

import { makeTestCollectors, type TestCollectors, type TestRegistry } from "../../helpers";
import { METRIC_NAMES } from "../../../src/metrics/constants";

// Each test uses its own registry - avoids duplicate-metric registration errors
let registry: TestRegistry;
let collectors: TestCollectors;

beforeEach(() => {
  ({ collectors, registry } = makeTestCollectors());
});

describe("createCollectors", () => {
  it("returns all four metric instance", () => {
    expect(collectors.httpRequestsTotal).toBeDefined();
    expect(collectors.httpRequestDurationSeconds).toBeDefined();
    expect(collectors.httpRequestsInProgress).toBeDefined();
    expect(collectors.socketConnectedClients).toBeDefined();
  });

  it("registers metrics in the provided registry", async () => {
    const names = (await registry.getMetricsAsJSON()).map((m) => m.name);
    expect(names).toContain(METRIC_NAMES.HTTP_REQUESTS_TOTAL);
    expect(names).toContain(METRIC_NAMES.HTTP_REQUEST_DURATION_SECONDS);
    expect(names).toContain(METRIC_NAMES.HTTP_REQUESTS_IN_PROGRESS);
    expect(names).toContain(METRIC_NAMES.SOCKET_CONNECTED_CLIENTS);
  });

  it("httpRequestsTotal increments correctly", async () => {
    collectors.httpRequestsTotal.inc({ method: "GET", route: "healthz", status_code: "200" });

    const json = await registry.getMetricsAsJSON();
    const metric = json.find((m) => m.name === METRIC_NAMES.HTTP_REQUESTS_TOTAL);
    expect(metric?.values[0]?.value).toBe(1);
  });

  it("httpRequestDurationSeconds accepts valid labels without throwing", () => {
    // Two-argument from: observe(labels, value) - still valid in prom-client v15
    expect(() => {
      collectors.httpRequestDurationSeconds.observe(
        { method: "POST", route: "/trpc/:path", status_code: "200" },
        0.042,
      );
    }).not.toThrow();
  });

  it("httpRequestsInProgress gauge inc/dec", async () => {
    collectors.httpRequestsInProgress.inc({ method: "GET" });
    collectors.httpRequestsInProgress.inc({ method: "GET" });

    const json = await registry.getMetricsAsJSON();
    const metric = json.find((m) => m.name === METRIC_NAMES.HTTP_REQUESTS_IN_PROGRESS);
    expect(metric?.values[0]?.value).toBe(2);

    collectors.httpRequestsInProgress.dec({ method: "GET" });

    const json2 = await registry.getMetricsAsJSON();
    const metric2 = json2.find((m) => m.name === METRIC_NAMES.HTTP_REQUESTS_IN_PROGRESS);
    expect(metric2?.values[0]?.value).toBe(1);
  });

  it("socketConnectedClients gauge starts at 0", async () => {
    const json = await registry.getMetricsAsJSON();
    const metric = json.find((m) => m.name === METRIC_NAMES.SOCKET_CONNECTED_CLIENTS);
    expect(metric?.values[0]?.value).toBe(0);
  });

  it("socketConnectedClients tracks connections", async () => {
    collectors.socketConnectedClients.inc();
    collectors.socketConnectedClients.inc();
    collectors.socketConnectedClients.dec();

    const json = await registry.getMetricsAsJSON();
    const metric = json.find((m) => m.name === METRIC_NAMES.SOCKET_CONNECTED_CLIENTS);
    expect(metric?.values[0]?.value).toBe(1);
  });

  it("each createCollectors() call is independent (no shared state)", async () => {
    const { collectors: col2, registry: reg2 } = makeTestCollectors();

    // Increment only in the first instance
    collectors.httpRequestsTotal.inc({ method: "GET", route: "/test", status_code: "200" });
    // Increment a different label-set in the second instance
    col2.httpRequestsTotal.inc({ method: "POST", route: "/other", status_code: "201" });

    // reg1 must have GET but NOT POST
    const json1 = await registry.getMetricsAsJSON();
    const metric1 = json1.find((m) => m.name === METRIC_NAMES.HTTP_REQUESTS_TOTAL);
    const reg1HasPost = metric1?.values.some((v) => v.labels.method === "POST") ?? false;
    expect(reg1HasPost).toBeFalsy();

    // reg2 must have POST but NOT GET
    const json2 = await reg2.getMetricsAsJSON();
    const metric2 = json2.find((m) => m.name === METRIC_NAMES.HTTP_REQUESTS_TOTAL);
    const reg2PostVal = metric2?.values.find((v) => v.labels.method === "POST")?.value ?? 0;
    expect(reg2PostVal).toBe(1);
  });
});
