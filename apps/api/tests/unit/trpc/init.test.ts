import { describe, expect, it, vi } from "vitest";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import { createTRPCContext } from "../../../src/trpc/init";
import { getSessionUser } from "../../../src/utils/auth";
import { db, makeSessionUser, VALID_USER } from "../../helpers";
import { mockLogger } from "../../mocks/logger";

vi.mock("../../../src/utils/auth");

function makeOpts(cookie?: string): CreateExpressContextOptions {
  return {
    req: { headers: cookie === undefined ? {} : { cookie } },
  } as CreateExpressContextOptions;
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
});
