import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server-session", () => ({ getServerSessionFromHeaders: vi.fn() }));
vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database.js"));
vi.mock("pino", () => import("@/tests/mocks/pino.js"));

import { createWebTRPCContext } from "@/lib/trpc/context";
import { makeHeaders, makeSessionHeaders, mockServerSessionUser } from "@/tests/helpers";
import { getServerSessionFromHeaders } from "@/lib/auth/server-session";

describe("createWebTRPCContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns context with db, logger, and user fields", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(mockServerSessionUser);
    const ctx = await createWebTRPCContext({ headers: makeSessionHeaders("tok") });
    expect(ctx.db).toBeDefined();
    expect(ctx.logger).toBeDefined();
    expect(ctx.user).toBeDefined();
  });

  it("attaches user.id and user.email from the validated session", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(mockServerSessionUser);
    const ctx = await createWebTRPCContext({ headers: makeSessionHeaders("tok") });
    expect(ctx.user?.id).toBe(mockServerSessionUser.id);
    expect(ctx.user?.email).toBe(mockServerSessionUser.email);
  });

  it("sets user to null when session is not found", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(null);
    const ctx = await createWebTRPCContext({ headers: makeHeaders() });
    expect(ctx.user).toBeNull();
  });

  it("passes the provider Headers instance to getServerSessionFromHeaders", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(null);
    const h = makeSessionHeaders("check-pass");
    await createWebTRPCContext({ headers: h });
    expect(getServerSessionFromHeaders).toHaveBeenCalledWith(h);
  });

  it("does not throw for any valid Headers input", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(null);
    await expect(
      createWebTRPCContext({
        headers: makeHeaders({ cookie: "next-auth.session-token=abc", "x-custom": "v" }),
      }),
    ).resolves.not.toThrow();
  });
});
