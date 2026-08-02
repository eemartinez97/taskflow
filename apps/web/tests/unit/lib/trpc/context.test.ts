import { describe, expect, it, vi } from "vitest";

vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database"));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/utils/logger", () => ({ logger: { info: vi.fn() } }));

import { getSession } from "@/lib/auth/session";
import { createWebTRPCContext } from "@/lib/trpc/context";
import { mockAuthorizedUser } from "@/tests/support/fixtures";

describe("createWebTRPCContext", () => {
  it("builds a context carrying the resolved session user", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockAuthorizedUser);
    const ctx = await createWebTRPCContext({ headers: new Headers() });
    expect(ctx.user).toEqual(mockAuthorizedUser);
    expect(ctx.db).toBeDefined();
    expect(ctx.logger).toBeDefined();
  });

  it("builds a context with user=null for anonymous requests", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const ctx = await createWebTRPCContext({ headers: new Headers() });
    expect(ctx.user).toBeNull();
  });
});
