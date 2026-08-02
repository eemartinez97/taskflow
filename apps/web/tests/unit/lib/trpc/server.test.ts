import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => import("@/tests/mocks/server-only"));
vi.mock("@taskflow/api/trpc", () => import("@/tests/mocks/taskflow-api"));
vi.mock("next/headers", () => import("@/tests/mocks/next-headers"));
vi.mock("@/lib/trpc/context", () => ({ createWebTRPCContext: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/trpc/no-op-io", () => ({ noOpIo: {} }));

describe("getServerTRPC", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("builds the router with the no-op IO server exactly once (memoized)", async () => {
    const { getServerTRPC } = await import("@/lib/trpc/server");
    const { createAppRouter } = await import("@taskflow/api/trpc");

    await getServerTRPC();
    await getServerTRPC();
    expect(createAppRouter).toHaveBeenCalledTimes(1);
  });

  it("returns a caller built from createCallerFactory", async () => {
    const { getServerTRPC } = await import("@/lib/trpc/server");
    const { createCallerFactory } = await import("@taskflow/api/trpc");

    const caller = await getServerTRPC();
    expect(createCallerFactory).toHaveBeenCalled();
    expect(caller).toBeDefined();
  });
});
