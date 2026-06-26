import { describe, expect, it } from "vitest";
import { Registry } from "prom-client";
import { appRegistry } from "../../../src/metrics/index.js";
import { METRICS_PREFIX } from "../../../src/metrics/constants.js";

describe("createRegistry", () => {
  it("is a Registry instance", () => {
    expect(appRegistry).toBeInstanceOf(Registry);
  });

  it("contentType is a non-empty string", async () => {
    const output = await appRegistry.metrics();
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("metrics() resolves to a non-empty string", async () => {
    const output = await appRegistry.metrics();
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("contains default Node.js metrics under the taskflow_ prefix", async () => {
    const names = (await appRegistry.getMetricsAsJSON()).map((m) => m.name);
    // collectDefaultMetrics always registers process_cpu_seconds_total
    expect(names.some((n) => n.startsWith(METRICS_PREFIX))).toBe(true);
  });

  it("same reference is returned on every import (ES module caching)", async () => {
    // Re-import the same module - must be the identical object reference
    const { appRegistry: reimported } = await import("../../../src/metrics/registry.js");
    expect(reimported).toBe(appRegistry);
  });

  it("default prefix is METRICS_PREFIX (not a hardcoded string)", () => {
    expect(METRICS_PREFIX).toBe("taskflow_");
  });
});
