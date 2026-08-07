import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@taskflow/database";
import { POST } from "@/app/api/test/reset/route";
import { makeRequest } from "../helpers/request";

vi.mock("@taskflow/database", () => ({
  prisma: {
    org: { deleteMany: vi.fn<(...args: unknown[]) => Promise<unknown>>() },
    user: { deleteMany: vi.fn<(...args: unknown[]) => Promise<unknown>>() },
  },
}));

const mockOrgDeleteMany = vi.mocked(prisma.org.deleteMany);
const mockUserDeleteMany = vi.mocked(prisma.user.deleteMany);

const TEST_SECRET = "a-fake-e2e-secret-value";
const SECRET_HEADER = { "x-e2e-secret": TEST_SECRET };

describe("POST /api/test/reset", () => {
  const originalFlag = process.env.ENABLE_TEST_ROUTES;
  const originalSecret = process.env.E2E_TEST_SECRET;

  beforeEach(() => {
    mockOrgDeleteMany.mockResolvedValue({ count: 0 });
    mockUserDeleteMany.mockResolvedValue({ count: 0 });
    process.env.E2E_TEST_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.ENABLE_TEST_ROUTES = originalFlag;
    process.env.E2E_TEST_SECRET = originalSecret;
  });

  it("returns 404 when ENABLE_TEST_ROUTES is not set", async () => {
    delete process.env.ENABLE_TEST_ROUTES;

    const res = await POST(
      makeRequest("/api/test/reset", { method: "POST", headers: SECRET_HEADER }),
    );

    expect(res.status).toBe(404);
    expect(mockOrgDeleteMany).not.toHaveBeenCalled();
    expect(mockUserDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the x-e2e-secret header is missing, even with ENABLE_TEST_ROUTES=true", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";

    const res = await POST(makeRequest("/api/test/reset", { method: "POST" }));

    expect(res.status).toBe(404);
    expect(mockOrgDeleteMany).not.toHaveBeenCalled();
    expect(mockUserDeleteMany).not.toHaveBeenCalled();
  });

  it("wipes every non-seed org and user, then returns ok", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";

    const res = await POST(
      makeRequest("/api/test/reset", { method: "POST", headers: SECRET_HEADER }),
    );
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockOrgDeleteMany).toHaveBeenCalledWith({ where: { slug: { not: "demo-org" } } });
    expect(mockUserDeleteMany).toHaveBeenCalledWith({
      where: { email: { not: "admin@taskflow.dev" } },
    });
  });
});
