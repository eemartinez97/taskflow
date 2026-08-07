import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/test/last-email/route";
import { inMemoryEmailSender } from "@/lib/mail/sender";

const TEST_SECRET = "a-fake-e2e-secret-value";

function makeRequest(url: string, withSecret = true): NextRequest {
  return new NextRequest(url, withSecret ? { headers: { "x-e2e-secret": TEST_SECRET } } : {});
}

describe("GET /api/test/last-email", () => {
  const originalFlag = process.env.ENABLE_TEST_ROUTES;
  const originalSecret = process.env.E2E_TEST_SECRET;

  beforeEach(() => {
    inMemoryEmailSender.clear();
    process.env.E2E_TEST_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.ENABLE_TEST_ROUTES = originalFlag;
    process.env.E2E_TEST_SECRET = originalSecret;
  });

  it("returns 404 when ENABLE_TEST_ROUTES is not set", async () => {
    delete process.env.ENABLE_TEST_ROUTES;
    const res = await GET(makeRequest("http://localhost/api/test/last-email?to=a@b.com"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the x-e2e-secret header is missing, even with ENABLE_TEST_ROUTES=true", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    const res = await GET(makeRequest("http://localhost/api/test/last-email?to=a@b.com", false));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the 'to' query parameter is missing", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    const res = await GET(makeRequest("http://localhost/api/test/last-email"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no email was captured for the address", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    const res = await GET(makeRequest("http://localhost/api/test/last-email?to=nobody@b.com"));
    expect(res.status).toBe(404);
  });

  it("returns the captured email's html when found", async () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    await inMemoryEmailSender.send({ to: "a@b.com", subject: "Hi", html: "<p>token=abc123</p>" });
    const res = await GET(makeRequest("http://localhost/api/test/last-email?to=a@b.com"));
    const body = (await res.json()) as { html: string; subject: string };
    expect(res.status).toBe(200);
    expect(body.subject).toBe("Hi");
    expect(body.html).toContain("token=abc123");
  });
});
