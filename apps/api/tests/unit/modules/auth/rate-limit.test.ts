import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { PrismaClient } from "@taskflow/database";
import {
  checkAuthEmailRateLimit,
  checkAuthIpRateLimit,
  checkLoginEmailRateLimit,
  checkLoginIpRateLimit,
  enforceAuthRateLimit,
  releaseAuthEmailRateLimit,
  releaseAuthIpRateLimit,
  releaseAuthRateLimit,
} from "../../../../src/modules/auth/rate-limit";

function createMockDb(): PrismaClient {
  return {
    $queryRaw: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    $executeRaw: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  } as unknown as PrismaClient;
}

const RESET_AT = new Date("2026-01-01T00:15:00.000Z");

describe("checkAuthEmailRateLimit", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
  });

  it("is not limited when the bucket's count is at or under the limit", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 1, resetAt: RESET_AT }]);

    const result = await checkAuthEmailRateLimit(db, "a@b.com", null);

    expect(result).toEqual({ limited: false, windowToken: RESET_AT.getTime() });
  });

  it("is limited once the bucket's count exceeds the limit", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 4, resetAt: RESET_AT }]);

    const result = await checkAuthEmailRateLimit(db, "a@b.com", null);

    expect(result).toEqual({ limited: true, windowToken: RESET_AT.getTime() });
  });

  it("normalizes the email (trims + lowercases) and prefixes the bucket key", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 1, resetAt: RESET_AT }]);

    await checkAuthEmailRateLimit(db, "  Alice@TaskFlow.DEV  ", null);

    expect(vi.mocked(db.$queryRaw).mock.calls[0]).toContain("email:alice@taskflow.dev");
  });

  it("throws if the upsert unexpectedly returns no row", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([]);

    await expect(checkAuthEmailRateLimit(db, "a@b.com", null)).rejects.toThrow(
      "RateLimitBucket upsert returned no row",
    );
  });
});

describe("releaseAuthEmailRateLimit", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
  });

  it("issues the decrement with the normalized, prefixed key and the window's resetAt", async () => {
    vi.mocked(db.$executeRaw).mockResolvedValue(1);

    await releaseAuthEmailRateLimit(db, "  ALICE@TASKFLOW.DEV  ", RESET_AT.getTime());

    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(vi.mocked(db.$executeRaw).mock.calls[0]).toContain("email:alice@taskflow.dev");
    expect(vi.mocked(db.$executeRaw).mock.calls[0]).toContainEqual(RESET_AT);
  });

  it("is a no-op when windowToken is null", async () => {
    await releaseAuthEmailRateLimit(db, "a@b.com", null);

    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("checkAuthIpRateLimit", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
  });

  it("is not limited when the bucket's count is at or under the (higher, IP-scoped) limit", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 9, resetAt: RESET_AT }]);

    const result = await checkAuthIpRateLimit(db, "203.0.113.5", null);

    expect(result).toEqual({ limited: false, windowToken: RESET_AT.getTime() });
  });

  it("is limited once the bucket's count exceeds the IP limit", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 11, resetAt: RESET_AT }]);

    const result = await checkAuthIpRateLimit(db, "203.0.113.5", null);

    expect(result).toEqual({ limited: true, windowToken: RESET_AT.getTime() });
  });

  it("prefixes the bucket key so it can never collide with an email key", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 1, resetAt: RESET_AT }]);

    await checkAuthIpRateLimit(db, "203.0.113.5", null);

    expect(vi.mocked(db.$queryRaw).mock.calls[0]).toContain("ip:203.0.113.5");
  });
});

describe("releaseAuthIpRateLimit", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
  });

  it("issues the decrement with the prefixed key and the window's resetAt", async () => {
    vi.mocked(db.$executeRaw).mockResolvedValue(1);

    await releaseAuthIpRateLimit(db, "203.0.113.5", RESET_AT.getTime());

    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(vi.mocked(db.$executeRaw).mock.calls[0]).toContain("ip:203.0.113.5");
    expect(vi.mocked(db.$executeRaw).mock.calls[0]).toContainEqual(RESET_AT);
  });

  it("is a no-op when windowToken is null", async () => {
    await releaseAuthIpRateLimit(db, "203.0.113.5", null);

    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("checkLoginEmailRateLimit", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
  });

  it("is not limited at or under the login-specific limit", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 5, resetAt: RESET_AT }]);

    expect(await checkLoginEmailRateLimit(db, "a@b.com", null)).toEqual({
      limited: false,
      windowToken: RESET_AT.getTime(),
    });
  });

  it("is limited once the count exceeds the login-specific limit", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 6, resetAt: RESET_AT }]);

    expect(await checkLoginEmailRateLimit(db, "a@b.com", null)).toEqual({
      limited: true,
      windowToken: RESET_AT.getTime(),
    });
  });

  it("uses a bucket key namespace distinct from checkAuthEmailRateLimit's, so a login burst never shares quota with register/forgot-password", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 1, resetAt: RESET_AT }]);

    await checkLoginEmailRateLimit(db, "a@b.com", null);

    expect(vi.mocked(db.$queryRaw).mock.calls[0]).toContain("login-email:a@b.com");
  });
});

describe("checkLoginIpRateLimit", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
  });

  it("is not limited at or under the login-specific IP limit", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 20, resetAt: RESET_AT }]);

    expect(await checkLoginIpRateLimit(db, "203.0.113.5", null)).toEqual({
      limited: false,
      windowToken: RESET_AT.getTime(),
    });
  });

  it("is limited once the count exceeds the login-specific IP limit", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 21, resetAt: RESET_AT }]);

    expect(await checkLoginIpRateLimit(db, "203.0.113.5", null)).toEqual({
      limited: true,
      windowToken: RESET_AT.getTime(),
    });
  });

  it("uses a bucket key namespace distinct from checkAuthIpRateLimit's", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 1, resetAt: RESET_AT }]);

    await checkLoginIpRateLimit(db, "203.0.113.5", null);

    expect(vi.mocked(db.$queryRaw).mock.calls[0]).toContain("login-ip:203.0.113.5");
  });
});

describe("enforceAuthRateLimit", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns both check results when neither axis is limited", async () => {
    vi.mocked(db.$queryRaw)
      .mockResolvedValueOnce([{ count: 1, resetAt: RESET_AT }]) // email
      .mockResolvedValueOnce([{ count: 1, resetAt: RESET_AT }]); // ip

    const state = await enforceAuthRateLimit(db, "a@b.com", "203.0.113.5", null);

    expect(state.emailCheck.limited).toBe(false);
    expect(state.ipCheck?.limited).toBe(false);
  });

  it("skips the IP check entirely when clientIp is null", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([{ count: 1, resetAt: RESET_AT }]);

    const state = await enforceAuthRateLimit(db, "a@b.com", null, null);

    expect(state.ipCheck).toBeNull();
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });

  it("throws TOO_MANY_REQUESTS and releases the unused IP quota when only the email axis is limited", async () => {
    vi.mocked(db.$queryRaw)
      .mockResolvedValueOnce([{ count: 4, resetAt: RESET_AT }]) // email: limited
      .mockResolvedValueOnce([{ count: 1, resetAt: RESET_AT }]); // ip: not limited

    await expect(enforceAuthRateLimit(db, "a@b.com", "203.0.113.5", null)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(vi.mocked(db.$executeRaw).mock.calls[0]).toContain("ip:203.0.113.5");
  });

  it("throws TOO_MANY_REQUESTS and releases the unused email quota when only the IP axis is limited", async () => {
    vi.mocked(db.$queryRaw)
      .mockResolvedValueOnce([{ count: 1, resetAt: RESET_AT }]) // email: not limited
      .mockResolvedValueOnce([{ count: 11, resetAt: RESET_AT }]); // ip: limited

    await expect(enforceAuthRateLimit(db, "a@b.com", "203.0.113.5", null)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(vi.mocked(db.$executeRaw).mock.calls[0]).toContain("email:a@b.com");
  });

  it("throws TOO_MANY_REQUESTS without releasing anything when both axes are limited", async () => {
    vi.mocked(db.$queryRaw)
      .mockResolvedValueOnce([{ count: 4, resetAt: RESET_AT }]) // email: limited
      .mockResolvedValueOnce([{ count: 11, resetAt: RESET_AT }]); // ip: limited

    await expect(enforceAuthRateLimit(db, "a@b.com", "203.0.113.5", null)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("throws TOO_MANY_REQUESTS without touching the IP axis when clientIp is null and email is limited", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([{ count: 4, resetAt: RESET_AT }]);

    await expect(enforceAuthRateLimit(db, "a@b.com", null, null)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("releaseAuthRateLimit", () => {
  let db: PrismaClient;

  beforeEach(() => {
    db = createMockDb();
    vi.mocked(db.$executeRaw).mockResolvedValue(1);
  });

  it("releases both axes when a clientIp and ipCheck are present", async () => {
    await releaseAuthRateLimit(db, "a@b.com", "203.0.113.5", {
      emailCheck: { limited: false, windowToken: RESET_AT.getTime() },
      ipCheck: { limited: false, windowToken: RESET_AT.getTime() },
    });

    expect(db.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("releases only the email axis when clientIp is null", async () => {
    await releaseAuthRateLimit(db, "a@b.com", null, {
      emailCheck: { limited: false, windowToken: RESET_AT.getTime() },
      ipCheck: null,
    });

    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(vi.mocked(db.$executeRaw).mock.calls[0]).toContain("email:a@b.com");
  });

  it("releases only the email axis when clientIp is present but the state has no ipCheck", async () => {
    await releaseAuthRateLimit(db, "a@b.com", "203.0.113.5", {
      emailCheck: { limited: false, windowToken: RESET_AT.getTime() },
      ipCheck: null,
    });

    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(vi.mocked(db.$executeRaw).mock.calls[0]).toContain("email:a@b.com");
  });
});

describe("E2E bypass (isE2ERun() && x-e2e-secret header matches E2E_TEST_SECRET)", () => {
  let db: PrismaClient;
  const originalEnableTestRoutes = process.env.ENABLE_TEST_ROUTES;
  const originalE2ETestSecret = process.env.E2E_TEST_SECRET;

  beforeEach(() => {
    db = createMockDb();
  });

  afterEach(() => {
    process.env.ENABLE_TEST_ROUTES = originalEnableTestRoutes;
    process.env.E2E_TEST_SECRET = originalE2ETestSecret;
  });

  // tests/setup.ts already points DATABASE_URL at "localhost", so
  // isE2ERun() only needs this flag to report true in this suite.
  it("never touches the DB and reports not-limited when the caller's header matches E2E_TEST_SECRET (repeated `playwright test --repeat-each` runs must not trip this)", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = "test-secret";

    const emailResult = await checkAuthEmailRateLimit(db, "a@b.com", "test-secret");
    const ipResult = await checkAuthIpRateLimit(db, "203.0.113.5", "test-secret");

    expect(emailResult.limited).toBe(false);
    expect(ipResult.limited).toBe(false);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("a release() call for the bypass token safely no-ops (never matches a real bucket row)", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = "test-secret";
    const { windowToken } = await checkAuthEmailRateLimit(db, "a@b.com", "test-secret");

    await releaseAuthEmailRateLimit(db, "a@b.com", windowToken);

    expect(db.$executeRaw).toHaveBeenCalledOnce(); // still issues the UPDATE...
    expect(vi.mocked(db.$executeRaw).mock.calls[0]).toContainEqual(new Date(windowToken)); // ...but for a resetAt no real row has.
  });

  it("still enforces the real limit when ENABLE_TEST_ROUTES is not 'true' (a leaked/misconfigured flag must not bypass real production checks)", async () => {
    delete process.env.ENABLE_TEST_ROUTES;
    process.env.E2E_TEST_SECRET = "test-secret";
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 4, resetAt: RESET_AT }]);

    const result = await checkAuthEmailRateLimit(db, "a@b.com", "test-secret");

    expect(result.limited).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });

  it("still enforces the real limit when E2E_TEST_SECRET is missing, even with ENABLE_TEST_ROUTES=true on a local DB (e.g. docker-compose.yml's DB host is named 'postgres', one of isE2ERun's local-database hostnames)", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    delete process.env.E2E_TEST_SECRET;
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 4, resetAt: RESET_AT }]);

    const result = await checkAuthEmailRateLimit(db, "a@b.com", "test-secret");

    expect(result.limited).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });

  it("still enforces the real limit when isE2ERun() is true but the caller's header does NOT match E2E_TEST_SECRET - only requests that prove they know the per-run secret bypass, not every request server-wide", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = "test-secret";
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 4, resetAt: RESET_AT }]);

    const result = await checkAuthEmailRateLimit(db, "a@b.com", "wrong-secret");

    expect(result.limited).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });

  it("still enforces the real limit when isE2ERun() is true but the caller sent no x-e2e-secret header at all", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = "test-secret";
    vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 4, resetAt: RESET_AT }]);

    const result = await checkAuthEmailRateLimit(db, "a@b.com", null);

    expect(result.limited).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });
});
