import { NextRequest } from "next/server";

const TEST_BASE_URL = "http://localhost:3000";

/** Creates a POST NextRequest with a serialized JSON body. */
export function makePostRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`${TEST_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Creates a POST NextRequest whose body cannot be parsed as JSON. */
export function makeInvalidJsonRequest(path: string): NextRequest {
  return new NextRequest(`${TEST_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ invalid json !!",
  });
}

/** Creates a NextRequest for any method and path. */
export function makeRequest(
  path: string,
  init?: Pick<RequestInit, "method" | "headers">,
): NextRequest {
  return new NextRequest(`${TEST_BASE_URL}${path}`, init);
}
