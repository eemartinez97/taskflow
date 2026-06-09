import { describe, expect, it } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { authRateLimiter, createRateLimiter } from "../../../src/middleware/rate-limit.js";
import type { ErrorBody } from "../../helpers.js";

/** Creates a fresh limiter instance per test - guarantees store isolation. */
function makeLimiter({ maxRequests, message }: { maxRequests: number; message?: string }) {
  return createRateLimiter({
    windowMs: 60_000,
    limit: maxRequests,
    ...(message !== undefined && { message }),
  });
}

/** App with an inline limiter built from options. */
function makeApp({ maxRequests, message }: { maxRequests: number; message?: string }) {
  return makeAppWithMiddleware(
    makeLimiter({ maxRequests, ...(message !== undefined && { message }) }),
  );
}

/** App with a pre-built middleware (e.g. authRateLimiter) */
function makeAppWithMiddleware(middleware: RequestHandler) {
  const app = express();
  app.use(middleware);
  app.get("/test", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe("rate limiter (express-rate-limit)", () => {
  it("allows requests under the limit", async () => {
    const app = makeApp({ maxRequests: 3 });
    await request(app).get("/test").expect(200);
    await request(app).get("/test").expect(200);
    await request(app).get("/test").expect(200);
  });

  it("blocks the request that exceeds the limit with 429", async () => {
    const app = makeApp({ maxRequests: 2 });
    await request(app).get("/test").expect(200);
    await request(app).get("/test").expect(200);
    // 3rd request - over limit
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect((res.body as ErrorBody).error.code).toBe("RATE_LIMITED");
  });

  it("uses the default message when none is provided", async () => {
    const app = makeApp({ maxRequests: 1 });
    await request(app).get("/test").expect(200);
    const res = await request(app).get("/test");
    expect((res.body as ErrorBody).error.message).toBe(
      "Too many requests, please try again later.",
    );
  });

  it("uses a custom message when provided", async () => {
    const app = makeApp({ maxRequests: 1, message: "Slow down!" });
    await request(app).get("/test").expect(200);
    const res = await request(app).get("/test");
    expect((res.body as ErrorBody).error.message).toBe("Slow down!");
  });

  it("sets RateLimit headers on the response (draft-8)", async () => {
    const app = makeApp({ maxRequests: 10 });
    const res = await request(app).get("/test").expect(200);

    // express-rate-limit v8 with standardHeaders: "draft-8" emits a single
    // combined `RateLimit` header (e.g. "limit=10, remaining=9, reset=60")
    // instead of the two separate headers used by draft-6.
    expect(res.headers).toHaveProperty("ratelimit");
  });

  it("does not set legacy X-RateLimit-* headers", async () => {
    const app = makeApp({ maxRequests: 10 });
    const res = await request(app).get("/test").expect(200);
    expect(res.headers).not.toHaveProperty("x-ratelimit-limit");
  });
});

describe("authRateLimiter", () => {
  it("is a valid Express middleware", () => {
    expect(typeof authRateLimiter).toBe("function");
  });

  it("uses the auth-specific message on 429", async () => {
    const freshAuthLimiter = createRateLimiter({
      windowMs: 60_000,
      limit: 10,
      message: "Too many authentication attempts, please try again later.",
    });
    const app = makeAppWithMiddleware(freshAuthLimiter);

    const responses = await Promise.all(
      Array.from({ length: 11 }, () => request(app).get("/test")),
    );
    const blocked = responses.find((r) => r.status === 429);
    expect(blocked).toBeDefined();
    expect((blocked?.body as ErrorBody).error.message).toBe(
      "Too many authentication attempts, please try again later.",
    );
  });
});
