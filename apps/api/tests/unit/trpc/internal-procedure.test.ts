import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { makeCtx } from "../../helpers";
import { env as baseMockEnv } from "../../../src/config/__mocks__/env";

const REAL_SECRET = "a".repeat(32);

function mockEnvModule(internalApiSecret: string | undefined): void {
  vi.doMock("../../../src/config/env", () => ({
    env: { ...baseMockEnv, INTERNAL_API_SECRET: internalApiSecret },
  }));
}

/** Builds a tiny router + caller against a freshly re-imported procedures module. */
async function buildCaller(internalSecretHeader: string | null) {
  const { internalProcedure } = await import("../../../src/trpc/procedures");
  const { createTRPCRouter, createCallerFactory } = await import("../../../src/trpc/init");

  const router = createTRPCRouter({
    ping: internalProcedure.input(z.object({}).optional()).query(() => "pong"),
  });

  return createCallerFactory(router)({ ...makeCtx(null), internalSecretHeader });
}

describe("internalProcedure (requireInternalSecret)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../../../src/config/env");
  });

  it("allows the call through with no header when INTERNAL_API_SECRET is unset (dev)", async () => {
    mockEnvModule(undefined);

    const caller = await buildCaller(null);

    await expect(caller.ping()).resolves.toBe("pong");
  });

  it("rejects with UNAUTHORIZED when a secret is configured and the header is missing", async () => {
    mockEnvModule(REAL_SECRET);

    const caller = await buildCaller(null);

    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects with UNAUTHORIZED when the header does not match", async () => {
    mockEnvModule(REAL_SECRET);

    const caller = await buildCaller("wrong-secret-wrong-secret-wrong");

    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects with UNAUTHORIZED when the header is a different length than the secret (no timingSafeEqual crash)", async () => {
    mockEnvModule(REAL_SECRET);

    const caller = await buildCaller("short");

    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("allows the call through when the header matches exactly", async () => {
    mockEnvModule(REAL_SECRET);

    const caller = await buildCaller(REAL_SECRET);

    await expect(caller.ping()).resolves.toBe("pong");
  });
});
