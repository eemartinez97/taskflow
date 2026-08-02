import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { makeAuthCookie } from "../helpers";
import { recordingIo } from "./setup/caller";
import { resetDb } from "./setup/db";
import { seedWorkspace } from "./setup/seed";
import { trpcResult } from "../support/trpc-http";

const app = createApp(recordingIo);

beforeEach(async () => {
  await resetDb();
});

describe("HTTP + tRPC + Postgres", () => {
  it("serves the health probes", async () => {
    await expect(request(app).get("/healthz")).resolves.toMatchObject({ status: 200 });
  });

  it("rejects protected procedures without a session cookie", async () => {
    const res = await request(app).get("/trpc/auth.me");

    expect(res.status).toBe(401);
  });

  it("resolves auth.me from a real NextAuth v4 cookie", async () => {
    const { owner } = await seedWorkspace();
    const cookie = await makeAuthCookie({ sub: owner.id, email: owner.email, name: owner.name });

    const res = await request(app).get("/trpc/auth.me").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(trpcResult(res.body)).toMatchObject({ id: owner.id });
  });

  it("rejects a cookie signed with the wrong secret", async () => {
    const { owner } = await seedWorkspace();
    const cookie = await makeAuthCookie(
      { sub: owner.id, email: owner.email },
      { secret: "another-secret-that-is-long-enough" },
    );

    await expect(request(app).get("/trpc/auth.me").set("Cookie", cookie)).resolves.toMatchObject({
      status: 401,
    });
  });

  it("applies CORS to the configured origin only", async () => {
    const res = await request(app)
      .options("/trpc/auth.me")
      .set("Origin", "http://evil.example")
      .set("Access-Control-Request-Method", "POST");

    expect(res.headers["access-control-allow-origin"]).not.toBe("http://evil.example");
  });

  it("exposes request metrics after real traffic", async () => {
    await request(app).get("/healthz");

    const res = await request(app).get("/metrics");

    expect(res.text).toContain("taskflow_http_requests_total");
    expect(res.text).toContain('route="/healthz"');
  });
});
