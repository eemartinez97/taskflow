import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type { ErrorBody } from "../helpers.js";

describe("Health endpoints", () => {
  // Import createApp, not the server - avoids binding to a port during tests
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  it("GET /healthz returns 200 with status ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /readyz returns 200 with status ready", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready" });
  });

  it("GET /unknown returns 404 with NOT_FOUND code", async () => {
    const res = await request(app).get("/unknown-route");
    expect(res.status).toBe(404);
    expect((res.body as ErrorBody).error.code).toBe("NOT_FOUND");
  });
});
