import { describe, expect, it, vi } from "vitest";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import { createTRPCContext } from "../../../src/trpc/init";
import { getSessionUser } from "../../../src/utils/auth";
import { db, makeSessionUser, VALID_USER } from "../../helpers";
import { mockLogger } from "../../mocks/logger";

vi.mock("../../../src/utils/auth");

function makeOpts(
  cookie?: string,
  ip?: string,
  internalSecret?: string | string[],
  e2eSecret?: string | string[],
): CreateExpressContextOptions {
  const headers: Record<string, string | string[]> = {};
  if (cookie !== undefined) headers.cookie = cookie;
  if (internalSecret !== undefined) headers["x-internal-secret"] = internalSecret;
  if (e2eSecret !== undefined) headers["x-e2e-secret"] = e2eSecret;
  return { req: { headers, ip } } as CreateExpressContextOptions;
}

describe("createTRPCContext", () => {
  it("forwards the Cookie header to getSessionUser", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(makeSessionUser());

    const ctx = await createTRPCContext(makeOpts("next-auth.session-token=abc"));

    expect(getSessionUser).toHaveBeenCalledWith("next-auth.session-token=abc");
    expect(ctx.user).toMatchObject({ id: VALID_USER.id, email: VALID_USER.email });
  });

  it("passes null when there is no Cookie header", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts());

    expect(getSessionUser).toHaveBeenCalledWith(null);
    expect(ctx.user).toBeNull();
  });

  it("injects the prisma client and the logger", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts());

    expect(ctx.db).toBe(db);
    expect(ctx.logger).toBe(mockLogger);
  });

  it("exposes Express's resolved req.ip as clientIp", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts(undefined, "203.0.113.5"));

    expect(ctx.clientIp).toBe("203.0.113.5");
  });

  it("falls back to null when req.ip is unavailable", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts());

    expect(ctx.clientIp).toBeNull();
  });

  it("exposes the x-internal-secret header as internalSecretHeader", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts(undefined, undefined, "shhh"));

    expect(ctx.internalSecretHeader).toBe("shhh");
  });

  it("falls back to null when x-internal-secret is absent", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts());

    expect(ctx.internalSecretHeader).toBeNull();
  });

  it("falls back to null when x-internal-secret is repeated (array form)", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts(undefined, undefined, ["a", "b"]));

    expect(ctx.internalSecretHeader).toBeNull();
  });

  it("exposes the x-e2e-secret header as e2eSecretHeader", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts(undefined, undefined, undefined, "shhh"));

    expect(ctx.e2eSecretHeader).toBe("shhh");
  });

  it("falls back to null when x-e2e-secret is absent", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts());

    expect(ctx.e2eSecretHeader).toBeNull();
  });

  it("falls back to null when x-e2e-secret is repeated (array form)", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const ctx = await createTRPCContext(makeOpts(undefined, undefined, undefined, ["a", "b"]));

    expect(ctx.e2eSecretHeader).toBeNull();
  });
});
