import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database"));
vi.mock("pino", () => import("@/tests/mocks/pino"));
vi.mock("server-only");

import { makeHeaders, makeSessionHeaders, mockServerSessionUser } from "@/tests/helpers";
import { createWebTRPCContext } from "@/lib/trpc/context";
import { getSession } from "@/lib/auth/session";

describe("createWebTRPCContext", () => {
  beforeEach(() => vi.clearAllMocks());

  // -- Shape --

  it("returns an object with db, logger, and user fields", async () => {
    const ctx = await createWebTRPCContext({ headers: makeHeaders() });
    expect(ctx).toHaveProperty("db");
    expect(ctx).toHaveProperty("logger");
    expect(ctx).toHaveProperty("user");
  });

  it("db is defined", async () => {
    expect((await createWebTRPCContext({ headers: makeHeaders() })).db).toBeDefined();
  });

  it("logger is defined", async () => {
    expect((await createWebTRPCContext({ headers: makeHeaders() })).logger).toBeDefined();
  });

  // -- User assignment --

  it("attaches the session user when getSession resolves", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockServerSessionUser);

    const ctx = await createWebTRPCContext({ headers: makeSessionHeaders("tok") });

    expect(ctx.user?.id).toBe(mockServerSessionUser.id);
    expect(ctx.user?.email).toBe(mockServerSessionUser.email);
  });

  it("sets user to null when getSession returns null", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect((await createWebTRPCContext({ headers: makeHeaders() })).user).toBeNull();
  });

  // -- Side-effects --

  it("calls getSession exactly once per invocation", async () => {
    await createWebTRPCContext({ headers: makeHeaders() });
    expect(getSession).toHaveBeenCalledOnce();
  });

  // -- API surface --

  it("accepts any valid Headers without throwing", async () => {
    await expect(
      createWebTRPCContext({
        headers: makeHeaders({ cookie: "next-auth.session-token=abc", "x-custom": "v" }),
      }),
    ).resolves.not.toThrow();
  });

  it("accepts an empty Headers instance without throwing", async () => {
    await expect(createWebTRPCContext({ headers: new Headers() })).resolves.not.toThrow();
  });
});
