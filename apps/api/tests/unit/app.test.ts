import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp, handleTRPCError, isHealthCheckUrl } from "../../src/app";
import { env, isProduction } from "../../src/config/env";
import { getMe } from "../../src/modules/auth/service";
import { TRPCError } from "../../src/trpc/init";
import { getSessionUser } from "../../src/utils/auth";
import { errorBody, makeSessionUser, VALID_USER } from "../helpers";
import { mockIo } from "../mocks/socket";
import { mockLogger } from "../mocks/logger";
import { trpcError } from "../support/trpc-http";

vi.mock("../../src/config/env", () => ({
  env: {
    METRICS_TOKEN: "test-secret",
    API_PORT: 8001,
    NODE_ENV: "test",
    NEXTAUTH_SECRET: "test-nextauth-secret-32-chars-min!!",
    TRUSTED_PROXY_HOPS: 1,
  },
  isProduction: vi.fn(),
}));
vi.mock("../../src/utils/auth");
vi.mock("../../src/modules/auth/service");

const app = () => createApp(mockIo);

describe("isHealthCheckUrl", () => {
  it.each([
    ["/healthz", true],
    ["/readyz", true],
    ["/metrics", false],
    [undefined, false],
  ])("%s -> %s", (url, expected) => {
    expect(isHealthCheckUrl(url)).toBe(expected);
  });
});

describe("handleTRPCError", () => {
  it("logs internal server errors with the procedure path and the error itself when there's no cause", () => {
    const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    handleTRPCError({ path: "tasks.create", error });

    expect(mockLogger.error).toHaveBeenCalledWith(
      { path: "tasks.create", err: error },
      "tRPC internal server error",
    );
  });

  it("logs the ORIGINAL thrown error (cause), not the wrapping TRPCError - tRPC auto-wraps any non-TRPCError throw into an INTERNAL_SERVER_ERROR with cause set to what actually failed", () => {
    const original = new Error("Resend API request failed with status 401");
    const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: original });

    handleTRPCError({ path: "auth.register", error });

    expect(mockLogger.error).toHaveBeenCalledWith(
      { path: "auth.register", err: original },
      "tRPC internal server error",
    );
  });

  it.each([
    ["a non-internal TRPCError", new TRPCError({ code: "NOT_FOUND" })],
    ["a plain Error", new Error("boom")],
    ["a non-error value", "boom"],
  ])("stays quiet for %s", (_name, error) => {
    handleTRPCError({ path: undefined, error });

    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});

describe("HTTP surface", () => {
  beforeEach(() => {
    vi.mocked(isProduction).mockReturnValue(false);
    vi.mocked(getSessionUser).mockResolvedValue(null);
  });

  it.each([
    ["/healthz", { status: "ok" }],
    ["/readyz", { status: "ready" }],
  ])("GET %s -> 200", async (path, body) => {
    const res = await request(app()).get(path);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(body);
  });

  it("exposes the Prometheus scrape endpoint", async () => {
    const res = await request(app()).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("taskflow_");
  });

  it("configures trust proxy from TRUSTED_PROXY_HOPS so req.ip reflects the real client behind nginx", () => {
    expect(app().get("trust proxy")).toBe(1);
  });

  it("sets Helmet security headers", async () => {
    const res = await request(app()).get("/healthz");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it.each(["get", "post", "delete"] as const)("%s on an unknown path -> 404", async (method) => {
    const res = await request(app())[method]("/nope/nope");

    expect(res.status).toBe(404);
    expect(res.body).toEqual(errorBody("Not found", "NOT_FOUND"));
  });

  it("returns 404 on /metrics in production without a valid token", async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    const res = await request(app()).get("/metrics"); // no Authorization header
    expect(res.status).toBe(404);
  });

  it("returns 404 on /metrics in production with the wrong token", async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    const res = await request(app()).get("/metrics").set("Authorization", "Bearer wrong-secret");
    expect(res.status).toBe(404);
  });

  it("returns 404 on /metrics in production when METRICS_TOKEN is unset", async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    const original = env.METRICS_TOKEN;
    env.METRICS_TOKEN = "";
    try {
      const res = await request(app()).get("/metrics").set("Authorization", "Bearer test-secret");
      expect(res.status).toBe(404);
    } finally {
      env.METRICS_TOKEN = original;
    }
  });

  it("returns metrics in production with a valid Bearer token", async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    const res = await request(app()).get("/metrics").set("Authorization", "Bearer test-secret");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
  });
});

describe("tRPC adapter", () => {
  beforeEach(() => {
    vi.mocked(isProduction).mockReturnValue(false);
  });

  it("rejects protected procedures without a session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const res = await request(app()).get("/trpc/auth.me");

    expect(res.status).toBe(401);
    expect(trpcError(res).error.json.data.code).toBe("UNAUTHORIZED");
  });

  it("serves protected procedures with a valid session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(makeSessionUser());
    vi.mocked(getMe).mockResolvedValue({
      id: VALID_USER.id,
      email: VALID_USER.email,
      name: "Alice",
      image: null,
    });

    const res = await request(app()).get("/trpc/auth.me");

    expect(res.status).toBe(200);
    expect(getMe).toHaveBeenCalledWith(expect.anything(), VALID_USER.id);
  });

  // errorFormatter: the `cause` field is stripped in production only
  it("exposes error.cause outside production", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(makeSessionUser());
    vi.mocked(getMe).mockRejectedValue(
      new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: "db-offline" }),
    );

    const res = await request(app()).get("/trpc/auth.me");

    expect(res.status).toBe(500);
    expect(trpcError(res).error.json.data.cause).toMatchObject({ message: "db-offline" });
  });

  it("strips error.cause in production", async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    vi.mocked(getSessionUser).mockResolvedValue(makeSessionUser());
    vi.mocked(getMe).mockRejectedValue(
      new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: "db-offline" }),
    );

    const res = await request(app()).get("/trpc/auth.me");

    expect(trpcError(res).error.json.data.cause).toBeNull();
  });

  it("routes internal errors through the onError hook", async () => {
    const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    vi.mocked(getSessionUser).mockResolvedValue(makeSessionUser());
    vi.mocked(getMe).mockRejectedValue(error);

    await request(app()).get("/trpc/auth.me");

    expect(mockLogger.error).toHaveBeenCalledWith(
      { path: "auth.me", err: error },
      "tRPC internal server error",
    );
  });
});
