import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { testRouter } from "../../../src/routes/test";
import { inMemoryEmailSender, resetEmailSender } from "../../../src/mail/sender";
import { mockDb } from "../../mocks/database-mock";

const originalEnableTestRoutes = process.env.ENABLE_TEST_ROUTES;
const originalE2ETestSecret = process.env.E2E_TEST_SECRET;
const SECRET = "test-e2e-secret";

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/test", testRouter);
  return app;
}

describe("testRouter (/api/test)", () => {
  beforeEach(() => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = SECRET;
    resetEmailSender();
  });

  afterEach(() => {
    process.env.ENABLE_TEST_ROUTES = originalEnableTestRoutes;
    process.env.E2E_TEST_SECRET = originalE2ETestSecret;
    resetEmailSender();
  });

  describe("guard", () => {
    it("404s when the x-e2e-secret header is missing", async () => {
      const res = await request(buildApp()).get("/api/test/last-email?to=a@b.com");
      expect(res.status).toBe(404);
    });

    it("404s when the x-e2e-secret header does not match", async () => {
      const res = await request(buildApp())
        .get("/api/test/last-email?to=a@b.com")
        .set("x-e2e-secret", "wrong-secret-wrong-secret-wrong");
      expect(res.status).toBe(404);
    });

    it("404s when ENABLE_TEST_ROUTES is not 'true', even with the right secret", async () => {
      process.env.ENABLE_TEST_ROUTES = "false";
      const res = await request(buildApp())
        .get("/api/test/last-email?to=a@b.com")
        .set("x-e2e-secret", SECRET);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /last-email", () => {
    it("returns 400 when the 'to' query parameter is missing", async () => {
      const res = await request(buildApp()).get("/api/test/last-email").set("x-e2e-secret", SECRET);
      expect(res.status).toBe(400);
    });

    it("returns 404 when no email was captured for that address", async () => {
      const res = await request(buildApp())
        .get("/api/test/last-email?to=nobody@example.com")
        .set("x-e2e-secret", SECRET);
      expect(res.status).toBe(404);
    });

    it("returns the most recently captured email for the address", async () => {
      await inMemoryEmailSender().send({
        to: "a@b.com",
        subject: "Confirm your email",
        html: "<a href='/verify-email?token=abc'>link</a>",
        text: "link",
      });

      const res = await request(buildApp())
        .get("/api/test/last-email?to=a@b.com")
        .set("x-e2e-secret", SECRET);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        subject: "Confirm your email",
        html: "<a href='/verify-email?token=abc'>link</a>",
        text: "link",
      });
    });
  });

  describe("POST /reset", () => {
    it("deletes every non-seed org and user, and the seed admin's own notifications", async () => {
      mockDb.org.deleteMany.mockResolvedValue({ count: 3 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 2 });
      mockDb.notification.deleteMany.mockResolvedValue({ count: 4 });

      const res = await request(buildApp())
        .post("/api/test/reset")
        .set("x-e2e-secret", SECRET)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockDb.org.deleteMany).toHaveBeenCalledWith({
        where: { slug: { not: "demo-org" } },
      });
      expect(mockDb.user.deleteMany).toHaveBeenCalledWith({
        where: { email: { not: "admin@taskflow.dev" } },
      });
      expect(mockDb.notification.deleteMany).toHaveBeenCalledWith({
        where: { user: { email: "admin@taskflow.dev" } },
      });
    });
  });

  describe("POST /delete-org", () => {
    it("returns 400 when orgId is missing", async () => {
      const res = await request(buildApp())
        .post("/api/test/delete-org")
        .set("x-e2e-secret", SECRET)
        .send({});
      expect(res.status).toBe(400);
      expect(mockDb.org.deleteMany).not.toHaveBeenCalled();
    });

    it("deletes the org by id", async () => {
      mockDb.org.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(buildApp())
        .post("/api/test/delete-org")
        .set("x-e2e-secret", SECRET)
        .send({ orgId: "org-1" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockDb.org.deleteMany).toHaveBeenCalledWith({ where: { id: "org-1" } });
    });
  });
});
