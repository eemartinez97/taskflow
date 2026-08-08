import { describe, it, expect, vi } from "vitest";

vi.mock("@taskflow/database", async () => await import("@/tests/mocks/taskflow-database"));

describe("GET /api/debug-cookie-config", () => {
  it("returns the runtime cookies config - TEMPORARY, remove alongside the route", async () => {
    const { GET } = await import("@/app/api/debug-cookie-config/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { cookieDomainSet: boolean };
    expect(typeof body.cookieDomainSet).toBe("boolean");
  });
});
