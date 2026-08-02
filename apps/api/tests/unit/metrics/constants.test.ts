import { describe, expect, it } from "vitest";

import { METRIC_NAMES, METRICS_PREFIX } from "../../../src/metrics/constants";

describe("METRIC_NAMES", () => {
  it("prefixes every metric name", () => {
    for (const name of Object.values(METRIC_NAMES)) {
      expect(name.startsWith(METRICS_PREFIX)).toBe(true);
    }
  });

  it("has no duplicate names", () => {
    const values = Object.values(METRIC_NAMES);

    expect(new Set(values).size).toBe(values.length);
  });

  it("matches the Prometheus naming convention (snake_case, no dashes)", () => {
    for (const name of Object.values(METRIC_NAMES)) {
      expect(name).toMatch(/^[a-z_][a-z0-9_]*$/);
    }
  });
});
