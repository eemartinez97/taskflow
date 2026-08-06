import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@taskflow/database";
import { POST } from "@/app/api/test/delete-org/route";
import { makeInvalidJsonRequest, makePostRequest } from "../helpers/request";

vi.mock("@taskflow/database", () => ({
  prisma: {
    org: { deleteMany: vi.fn<(...args: unknown[]) => Promise<unknown>>() },
  },
}));

const mockOrgDeleteMany = vi.mocked(prisma.org.deleteMany);

const TEST_SECRET = "a-fake-e2e-secret-value";
const SECRET_HEADER = { "x-e2e-secret": TEST_SECRET };

describe("POST /api/test/delete-org", () => {
  const originalFlag = process.env.ENABLE_TEST_ROUTES;
  const originalSecret = process.env.E2E_TEST_SECRET;

  beforeEach(() => {
    mockOrgDeleteMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    process.env.ENABLE_TEST_ROUTES = originalFlag;
    process.env.E2E_TEST_SECRET = originalSecret;
  });

  it("returns 404 when ENABLE_TEST_ROUTES is not set", async () => {
    delete process.env.ENABLE_TEST_ROUTES;
    process.env.E2E_TEST_SECRET = TEST_SECRET;

    const res = await POST(
      makePostRequest("/api/test/delete-org", { orgId: "org-1" }, SECRET_HEADER),
    );

    expect(res.status).toBe(404);
    expect(mockOrgDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the x-e2e-secret header is missing, even with ENABLE_TEST_ROUTES=true", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;

    const res = await POST(makePostRequest("/api/test/delete-org", { orgId: "org-1" }));

    expect(res.status).toBe(404);
    expect(mockOrgDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the x-e2e-secret header doesn't match", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;

    const res = await POST(
      makePostRequest("/api/test/delete-org", { orgId: "org-1" }, { "x-e2e-secret": "wrong" }),
    );

    expect(res.status).toBe(404);
    expect(mockOrgDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 404 when E2E_TEST_SECRET isn't configured server-side", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    delete process.env.E2E_TEST_SECRET;

    const res = await POST(
      makePostRequest("/api/test/delete-org", { orgId: "org-1" }, SECRET_HEADER),
    );

    expect(res.status).toBe(404);
    expect(mockOrgDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 400 when 'orgId' is missing", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;

    const res = await POST(makePostRequest("/api/test/delete-org", {}, SECRET_HEADER));

    expect(res.status).toBe(400);
    expect(mockOrgDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable JSON body", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;

    const res = await POST(makeInvalidJsonRequest("/api/test/delete-org", SECRET_HEADER));

    expect(res.status).toBe(400);
    expect(mockOrgDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes the org by id and returns ok", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;

    const res = await POST(
      makePostRequest("/api/test/delete-org", { orgId: "org-1" }, SECRET_HEADER),
    );
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockOrgDeleteMany).toHaveBeenCalledWith({ where: { id: "org-1" } });
  });
});
