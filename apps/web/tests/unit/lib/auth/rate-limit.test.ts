import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@taskflow/database";
import {
  checkAuthEmailRateLimit,
  checkAuthIpRateLimit,
  releaseAuthEmailRateLimit,
  releaseAuthIpRateLimit,
  resetAuthEmailRateLimit,
} from "@/lib/auth/rate-limit";

vi.mock("@taskflow/database", () => ({
  prisma: {
    $queryRaw: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    $executeRaw: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    rateLimitBucket: { deleteMany: vi.fn<(...args: unknown[]) => Promise<unknown>>() },
  },
}));

const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockExecuteRaw = vi.mocked(prisma.$executeRaw);
const mockDeleteMany = vi.mocked(prisma.rateLimitBucket.deleteMany);

const RESET_AT = new Date("2026-01-01T00:15:00.000Z");

describe("checkAuthEmailRateLimit", () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
    mockExecuteRaw.mockReset();
    mockDeleteMany.mockReset();
  });

  it("is not limited when the bucket's count is at or under the limit", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1, resetAt: RESET_AT }]);

    const result = await checkAuthEmailRateLimit("a@b.com");

    expect(result).toEqual({ limited: false, windowToken: RESET_AT.getTime() });
  });

  it("is limited once the bucket's count exceeds the limit", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 4, resetAt: RESET_AT }]);

    const result = await checkAuthEmailRateLimit("a@b.com");

    expect(result).toEqual({ limited: true, windowToken: RESET_AT.getTime() });
  });

  it("normalizes the email (trims + lowercases) and prefixes the bucket key", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1, resetAt: RESET_AT }]);

    await checkAuthEmailRateLimit("  Alice@TaskFlow.DEV  ");

    expect(mockQueryRaw.mock.calls[0]).toContain("email:alice@taskflow.dev");
  });

  it("throws if the upsert unexpectedly returns no row", async () => {
    mockQueryRaw.mockResolvedValue([]);

    await expect(checkAuthEmailRateLimit("a@b.com")).rejects.toThrow(
      "RateLimitBucket upsert returned no row",
    );
  });
});

describe("releaseAuthEmailRateLimit", () => {
  beforeEach(() => {
    mockExecuteRaw.mockReset();
  });

  it("issues the decrement with the normalized, prefixed key and the window's resetAt", async () => {
    mockExecuteRaw.mockResolvedValue(1);

    await releaseAuthEmailRateLimit("  ALICE@TASKFLOW.DEV  ", RESET_AT.getTime());

    expect(mockExecuteRaw).toHaveBeenCalledOnce();
    expect(mockExecuteRaw.mock.calls[0]).toContain("email:alice@taskflow.dev");
    expect(mockExecuteRaw.mock.calls[0]).toContainEqual(RESET_AT);
  });

  it("is a no-op when windowToken is null", async () => {
    await releaseAuthEmailRateLimit("a@b.com", null);

    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});

describe("checkAuthIpRateLimit", () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it("is not limited when the bucket's count is at or under the (higher, IP-scoped) limit", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 9, resetAt: RESET_AT }]);

    const result = await checkAuthIpRateLimit("203.0.113.5");

    expect(result).toEqual({ limited: false, windowToken: RESET_AT.getTime() });
  });

  it("is limited once the bucket's count exceeds the IP limit", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 11, resetAt: RESET_AT }]);

    const result = await checkAuthIpRateLimit("203.0.113.5");

    expect(result).toEqual({ limited: true, windowToken: RESET_AT.getTime() });
  });

  it("prefixes the bucket key so it can never collide with an email key", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 1, resetAt: RESET_AT }]);

    await checkAuthIpRateLimit("203.0.113.5");

    expect(mockQueryRaw.mock.calls[0]).toContain("ip:203.0.113.5");
  });
});

describe("releaseAuthIpRateLimit", () => {
  beforeEach(() => {
    mockExecuteRaw.mockReset();
  });

  it("issues the decrement with the prefixed key and the window's resetAt", async () => {
    mockExecuteRaw.mockResolvedValue(1);

    await releaseAuthIpRateLimit("203.0.113.5", RESET_AT.getTime());

    expect(mockExecuteRaw).toHaveBeenCalledOnce();
    expect(mockExecuteRaw.mock.calls[0]).toContain("ip:203.0.113.5");
    expect(mockExecuteRaw.mock.calls[0]).toContainEqual(RESET_AT);
  });

  it("is a no-op when windowToken is null", async () => {
    await releaseAuthIpRateLimit("203.0.113.5", null);

    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});

describe("resetAuthEmailRateLimit", () => {
  it("deletes every tracked bucket", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    await resetAuthEmailRateLimit();

    expect(mockDeleteMany).toHaveBeenCalledWith({});
  });
});
