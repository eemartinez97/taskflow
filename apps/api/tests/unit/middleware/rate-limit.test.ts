import { afterEach, describe, expect, it, vi } from "vitest";

import type * as rateLimitModule from "../../../src/middleware/rate-limit";

const rateLimitFactory = vi.fn(() => vi.fn());
vi.mock("express-rate-limit", () => ({ default: rateLimitFactory }));

type RateLimitModule = typeof rateLimitModule;

interface EnvOverrides {
  RATE_LIMIT_WINDOW_MS?: number;
  RATE_LIMIT_MAX_REQUESTS?: number;
}

async function importFresh(
  isProduction = false,
  envOverrides: EnvOverrides = {},
): Promise<RateLimitModule> {
  vi.resetModules();
  // vi.doMock is NOT hoisted - runs here with the correct value baked into the factory
  vi.doMock("../../../src/config/env", () => ({
    isProduction: vi.fn().mockReturnValue(isProduction),
    env: envOverrides,
  }));
  return import("../../../src/middleware/rate-limit");
}

describe("createRateLimiter", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("merges the shared base options", async () => {
    const { createRateLimiter } = await importFresh();
    rateLimitFactory.mockClear();

    createRateLimiter({ windowMs: 1000, limit: 5 });

    expect(rateLimitFactory).toHaveBeenCalledWith({
      standardHeaders: "draft-8",
      legacyHeaders: false,
      windowMs: 1000,
      limit: 5,
      message: {
        error: { message: "Too many requests, please try again later.", code: "RATE_LIMITED" },
      },
    });
  });

  it("allows overriding the message", async () => {
    const { createRateLimiter } = await importFresh();
    rateLimitFactory.mockClear();

    createRateLimiter({ windowMs: 1, limit: 1, message: "Slow down" });

    expect(rateLimitFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        message: { error: { message: "Slow down", code: "RATE_LIMITED" } },
      }),
    );
  });

  it.each([
    ["production", true, 100],
    ["non-production", false, 1000],
  ])("defaultRateLimiter allows %s budget", async (_env, prod, limit) => {
    rateLimitFactory.mockClear();

    await importFresh(prod); // value is baked into the fresh factory

    expect(rateLimitFactory).toHaveBeenCalledWith(
      expect.objectContaining({ windowMs: 15 * 60 * 1000, limit }),
    );
  });

  it("defaultRateLimiter uses RATE_LIMIT_WINDOW_MS/RATE_LIMIT_MAX_REQUESTS when set", async () => {
    rateLimitFactory.mockClear();

    await importFresh(true, { RATE_LIMIT_WINDOW_MS: 60_000, RATE_LIMIT_MAX_REQUESTS: 500 });

    expect(rateLimitFactory).toHaveBeenCalledWith(
      expect.objectContaining({ windowMs: 60_000, limit: 500 }),
    );
  });

  it("defaultRateLimiter falls back to the isProduction() default for whichever override is unset", async () => {
    rateLimitFactory.mockClear();

    await importFresh(false, { RATE_LIMIT_WINDOW_MS: 60_000 });

    expect(rateLimitFactory).toHaveBeenCalledWith(
      expect.objectContaining({ windowMs: 60_000, limit: 1000 }),
    );
  });
});
