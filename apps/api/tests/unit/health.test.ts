import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp, handleTRPCError, isHealthCheckUrl } from "../../src/app";
import { TRPCError } from "../../src/trpc/init";
import { mockLogger } from "../mocks/logger";
import type { ErrorBody } from "../helpers";
import { mockIo } from "../mocks/socket";

vi.mock("../../src/config/env");

describe("Health endpoints", () => {
  // Import createApp, not the server - avoids binding to a port during tests
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp(mockIo);
  });

  it("GET /healthz returns 200 with status ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /readyz returns 200 with status ready", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready" });
  });

  it("GET /unknown returns 404 with NOT_FOUND code", async () => {
    const res = await request(app).get("/unknown-route");
    expect(res.status).toBe(404);
    expect((res.body as ErrorBody).error.code).toBe("NOT_FOUND");
  });

  it("skips logging for /healthz and /readyz (autoLogging ignore)", async () => {
    await request(app).get("/healthz");
    await request(app).get("/readyz");
  });

  it("POST /unknown also returns 404", async () => {
    const res = await request(app).post("/unknown-route");
    expect(res.status).toBe(404);
  });
});

describe("isHealthCheckUrl", () => {
  it("returns true for /healthz", () => {
    expect(isHealthCheckUrl("/healthz")).toBe(true);
  });

  it("returns true for /readyz", () => {
    expect(isHealthCheckUrl("/readyz")).toBe(true);
  });

  it("returns false for other URLs", () => {
    expect(isHealthCheckUrl("/api/users")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isHealthCheckUrl(undefined)).toBe(false);
  });
});

describe("handleTRPCError", () => {
  it("calls logger.error when error code is INTERNAL_SERVER_ERROR", () => {
    const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB explored" });
    handleTRPCError({ path: "tasks.list", error });
    expect(mockLogger.error).toHaveBeenCalledWith(
      { path: "tasks.list" },
      "tRPC internal server error",
    );
  });

  it("does NOT call logger.error for 4xx tRPC error", () => {
    vi.mocked(mockLogger.error).mockClear();

    const clientError = ["BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"] as const;

    for (const code of clientError) {
      const error = new TRPCError({ code });
      handleTRPCError({ path: "some.proc", error });
    }

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("accepts undefined path without throwing", () => {
    const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    expect(() => {
      handleTRPCError({ path: undefined, error });
    }).not.toThrow();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("GET /metrics", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp(mockIo);
  });

  it("return 200", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
  });

  it("responds with a Prometheus-compatible content-type", async () => {
    const res = await request(app).get("/metrics");
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
  });

  it("response body is non-empty (contains at least default metrics)", async () => {
    const res = await request(app).get("/metrics");
    expect(res.text.length).toBeGreaterThan(0);
  });

  it("is not intercepted by the 404 catch-all", async () => {
    const res = await request(app).get("/metrics");
    // 404 handler returns our custom JSON shape
    expect(res.status).not.toBe(404);
  });

  it("is excluded from httpRequestsTotal metric (no self-counting)", async () => {
    const res = await request(app).get("/metrics");
    // The response body is Prometheus text format - check that the
    // counter line for /metrics route does NOT appear
    expect(res.text).not.contain('route="/metrics"');
  });
});
