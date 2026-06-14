import { beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import request from "supertest";
import { type ErrorBody } from "../../helpers.js";

vi.mock("../../../src/config/env.js");

describe("tRPC HTTP adapter (Express)", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  it("responds with 404 to unknown tRPC procedure path (GET /trpc/unknown)", async () => {
    const res = await request(app).get("/trpc/unknown");

    // tRPC returns 404 for non-existent procedures
    expect(res.status).toBe(404);
  });

  it("tRPC endpoint is reachable at /trpc (not 404 from catch-all)", async () => {
    // Any valid tRPC to /trpc returns a tRPC-shaped error, not our catch-all 404
    const res = await request(app).get("/trpc/unknown").set("Accept", "application/json");
    // Our catch-all returns { error: { code: "NOT_FOUND" } }
    // tRPC returns its own error shape - code should NOT be our custom NOT_FOUND
    expect((res.body as ErrorBody).error.code).not.toBe("NOT_FOUND");
  });

  it("GET /healthz still works with tRPC mounted", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
