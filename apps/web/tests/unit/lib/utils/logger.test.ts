// apps/web/tests/unit/lib/logger.test.ts
import { describe, expect, it } from "vitest";
import { getLogLevel } from "@/lib/utils/logger";

describe("getLogLevel", () => {
  it("returns 'warn' in production", () => {
    expect(getLogLevel("production")).toBe("warn");
  });
  it("returns 'debug' outside production", () => {
    expect(getLogLevel("development")).toBe("debug");
    expect(getLogLevel("test")).toBe("debug");
  });
});
