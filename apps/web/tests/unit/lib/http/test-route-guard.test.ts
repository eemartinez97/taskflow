import { describe, expect, it, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { testRouteGuardResponse } from "@/lib/http/test-route-guard";

const SECRET_HEADER = "x-e2e-secret";
const TEST_SECRET = "correct-secret";

function makeRequest(secretHeader?: string): NextRequest {
  return new NextRequest("http://localhost/api/test/reset", {
    method: "POST",
    headers: secretHeader ? { [SECRET_HEADER]: secretHeader } : {},
  });
}

const ORIGINAL_ENV = {
  ENABLE_TEST_ROUTES: process.env.ENABLE_TEST_ROUTES,
  E2E_TEST_SECRET: process.env.E2E_TEST_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
};

afterEach(() => {
  process.env.ENABLE_TEST_ROUTES = ORIGINAL_ENV.ENABLE_TEST_ROUTES;
  process.env.E2E_TEST_SECRET = ORIGINAL_ENV.E2E_TEST_SECRET;
  process.env.DATABASE_URL = ORIGINAL_ENV.DATABASE_URL;
});

describe("testRouteGuardResponse", () => {
  it("404s when ENABLE_TEST_ROUTES is not 'true'", () => {
    delete process.env.ENABLE_TEST_ROUTES;
    process.env.E2E_TEST_SECRET = TEST_SECRET;

    const response = testRouteGuardResponse(makeRequest(TEST_SECRET));

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
  });

  it("404s when DATABASE_URL does not point at a local host", () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;
    process.env.DATABASE_URL = "postgresql://user:pass@db.production-host.example.com:5432/app";

    const response = testRouteGuardResponse(makeRequest(TEST_SECRET));

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
  });

  it("404s when DATABASE_URL is malformed (fails closed)", () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;
    process.env.DATABASE_URL = "not-a-valid-url";

    const response = testRouteGuardResponse(makeRequest(TEST_SECRET));

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
  });

  it("404s when DATABASE_URL is unset (fails closed)", () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;
    delete process.env.DATABASE_URL;

    const response = testRouteGuardResponse(makeRequest(TEST_SECRET));

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
  });

  it("404s when the secret header is missing", () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;
    process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";

    const response = testRouteGuardResponse(makeRequest());

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
  });

  it("404s when the secret header does not match", () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;
    process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";

    const response = testRouteGuardResponse(makeRequest("wrong-secret"));

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
  });

  it("returns null (allows the request through) when all three gates pass", () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;
    process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";

    const response = testRouteGuardResponse(makeRequest(TEST_SECRET));

    expect(response).toBeNull();
  });

  it("accepts the 127.0.0.1 and postgres local hostnames too", () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.E2E_TEST_SECRET = TEST_SECRET;

    process.env.DATABASE_URL = "postgresql://taskflow:changeme@127.0.0.1:5432/taskflow_test";
    expect(testRouteGuardResponse(makeRequest(TEST_SECRET))).toBeNull();

    process.env.DATABASE_URL = "postgresql://taskflow:changeme@postgres:5432/taskflow_test";
    expect(testRouteGuardResponse(makeRequest(TEST_SECRET))).toBeNull();
  });
});
