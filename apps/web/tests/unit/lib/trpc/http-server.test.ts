import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.client", () => ({
  publicEnv: {
    NEXT_PUBLIC_API_URL: "http://localhost:8000",
    NEXT_PUBLIC_WEB_URL: "http://localhost:3000",
  },
}));

describe("buildInternalSecretHeaders", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/env.server");
  });

  it("attaches x-internal-secret when INTERNAL_API_SECRET is set", async () => {
    vi.doMock("@/lib/env.server", () => ({
      serverEnv: { INTERNAL_API_SECRET: "a".repeat(32), E2E_TEST_SECRET: undefined },
    }));

    const { buildInternalSecretHeaders } = await import("@/lib/trpc/http-server");

    expect(buildInternalSecretHeaders()).toEqual({ "x-internal-secret": "a".repeat(32) });
  });

  it("attaches x-e2e-secret when E2E_TEST_SECRET is set", async () => {
    vi.doMock("@/lib/env.server", () => ({
      serverEnv: { INTERNAL_API_SECRET: undefined, E2E_TEST_SECRET: "b".repeat(32) },
    }));

    const { buildInternalSecretHeaders } = await import("@/lib/trpc/http-server");

    expect(buildInternalSecretHeaders()).toEqual({ "x-e2e-secret": "b".repeat(32) });
  });

  it("attaches both headers when both secrets are set", async () => {
    vi.doMock("@/lib/env.server", () => ({
      serverEnv: { INTERNAL_API_SECRET: "a".repeat(32), E2E_TEST_SECRET: "b".repeat(32) },
    }));

    const { buildInternalSecretHeaders } = await import("@/lib/trpc/http-server");

    expect(buildInternalSecretHeaders()).toEqual({
      "x-internal-secret": "a".repeat(32),
      "x-e2e-secret": "b".repeat(32),
    });
  });

  it("returns no headers when both secrets are unset", async () => {
    vi.doMock("@/lib/env.server", () => ({
      serverEnv: { INTERNAL_API_SECRET: undefined, E2E_TEST_SECRET: undefined },
    }));

    const { buildInternalSecretHeaders } = await import("@/lib/trpc/http-server");

    expect(buildInternalSecretHeaders()).toEqual({});
  });
});

describe("apiHttpClient's base URL", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/env.server");
    vi.doUnmock("@trpc/client");
  });

  it("uses INTERNAL_API_URL when set (docker-compose: apps/api's internal address, not the browser-facing origin)", async () => {
    const httpBatchLink = vi.fn(() => vi.fn());
    vi.doMock("@trpc/client", () => ({
      createTRPCClient: vi.fn(),
      httpBatchLink,
    }));
    vi.doMock("@/lib/env.server", () => ({
      serverEnv: { INTERNAL_API_URL: "http://api:8000" },
    }));

    await import("@/lib/trpc/http-server");

    expect(httpBatchLink).toHaveBeenCalledWith(
      expect.objectContaining({ url: "http://api:8000/trpc" }) as unknown,
    );
  });

  it("falls back to NEXT_PUBLIC_API_URL when INTERNAL_API_URL is unset (pnpm dev: same origin either way)", async () => {
    const httpBatchLink = vi.fn(() => vi.fn());
    vi.doMock("@trpc/client", () => ({
      createTRPCClient: vi.fn(),
      httpBatchLink,
    }));
    vi.doMock("@/lib/env.server", () => ({
      serverEnv: { INTERNAL_API_URL: undefined },
    }));

    await import("@/lib/trpc/http-server");

    expect(httpBatchLink).toHaveBeenCalledWith(
      expect.objectContaining({ url: "http://localhost:8000/trpc" }) as unknown,
    );
  });
});
