import { vi, type MockInstance } from "vitest";

export type FetchSpy = MockInstance<typeof fetch>;

/** Stubs globalThis.fetch with a vi.fn() spy. Pair with teardownFetchSpy() in afterEach. */
export function setupFetchSpy(defaultResponse?: Response): FetchSpy {
  const spy = vi.fn<typeof fetch>();
  if (defaultResponse) spy.mockResolvedValue(defaultResponse);
  vi.stubGlobal("fetch", spy);
  return spy;
}

export function teardownFetchSpy(): void {
  vi.unstubAllGlobals();
}

/** Builds a typed Response with a JSON body and the given status code. */
export function mockFetchResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Builds a POST Request with a JSON body for Route Handler unit tests. */
export function makeApiRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Builds a NextRequest-compatible mock where `.json()` rejects with a SyntaxError.
 * More reliable than passing raw malformed JSON in jsdom/Node environments.
 */
export function makeJsonThrowRequest(path: string): Request {
  return {
    json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
    url: `http://localhost${path}`,
    method: "POST",
  } as unknown as Request;
}
