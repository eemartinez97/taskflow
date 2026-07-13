import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { JWT } from "next-auth/jwt";

// ---------------------------------------------------------------------------
// vi.hoisted — create spies BEFORE vi.mock() hoisting runs
//
// WHY vi.hoisted():
//   vi.mock() factories are hoisted to the top of the file by the Vitest
//   transform. Module-level `const` declarations are NOT available in the
//   hoisted zone (temporal dead zone), so any spy referenced inside a factory
//   must be created via vi.hoisted() which also runs in the hoisted zone.
// ---------------------------------------------------------------------------
const { redirectMock, nextMock } = vi.hoisted(() => ({
  redirectMock: vi
    .fn<(url: URL) => { type: "redirect"; _url: URL }>()
    .mockImplementation((url: URL) => ({ type: "redirect" as const, _url: url })),
  nextMock: vi.fn<() => { type: "next" }>().mockReturnValue({ type: "next" as const }),
}));

const { getTokenMock } = vi.hoisted(() => ({
  getTokenMock: vi.fn<(opts: { req: NextRequest; secret: string }) => Promise<JWT | null>>(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// next/server: NextResponse is a Next.js-specific class unavailable in jsdom.
// Replace with trackable vi.fn() spies so redirect/next calls are assertable.
vi.mock("next/server", () => ({
  NextResponse: {
    redirect: redirectMock,
    next: nextMock,
  },
}));

// next-auth/jwt: getToken performs crypto + cookie parsing - replace with a spy
vi.mock("next-auth/jwt", () => ({ getToken: getTokenMock }));

// @/lib/env.server: imports server-only; mocked to inject a controlled secret
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    NODE_ENV: "test",
    NEXTAUTH_SECRET: "test-secret-value-at-least-16-chars",
    NEXTAUTH_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://test:test@localhost/test",
  },
}));

// ---------------------------------------------------------------------------
// Subject under test (imported AFTER mocks)
// ---------------------------------------------------------------------------

import { proxy, config } from "@/proxy";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3000";

/**
 * Builds a minimal NextRequest-compatible mock.
 * Only the properties read by `proxy` are required:
 *   - `nextUrl.pathname` — route branch logic
 *   - `url`             — base URL for building redirect targets
 *   - `headers`         — passed through to getToken (opaque to proxy)
 */
function makeNextRequest(pathname: string): NextRequest {
  return {
    nextUrl: { pathname },
    url: `${BASE_URL}${pathname}`,
    headers: new Headers(),
  } as unknown as NextRequest;
}

/** Extracts the URL object passed to the last `NextResponse.redirect` call. */
function capturedRedirectUrl(): URL {
  const call = redirectMock.mock.calls.at(-1);
  if (!call) throw new Error("NextResponse.redirect was not called");
  return call[0];
}

/** Minimal JWT token fixture — getToken returns this for authenticated users */
const AUTHENTICATED_TOKEN: JWT = { sub: "user-id", id: "user-id", email: "alice@test.com" };

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authenticated user on a public auth route → redirect /projects", () => {
    beforeEach(() => {
      getTokenMock.mockResolvedValue(AUTHENTICATED_TOKEN);
    });

    it.each(["/" as const, "/login" as const, "/register" as const])(
      "redirects '%s' to /projects",
      async (pathname) => {
        await proxy(makeNextRequest(pathname));

        expect(redirectMock).toHaveBeenCalledTimes(1);
        expect(capturedRedirectUrl().pathname).toBe("/projects");
        expect(nextMock).not.toHaveBeenCalled();
      },
    );

    it("constructs the redirect URL relative to the request base URL", async () => {
      await proxy(makeNextRequest("/login"));

      const redirectUrl = capturedRedirectUrl();
      expect(redirectUrl.origin).toBe(BASE_URL);
    });
  });

  describe("unauthenticated user on a protected route → redirect /login?callbackUrl", () => {
    beforeEach(() => {
      getTokenMock.mockResolvedValue(null);
    });

    it.each(["/projects", "/settings", "/team", "/projects/abc/board"])(
      "redirects '%s' to /login",
      async (pathname) => {
        await proxy(makeNextRequest(pathname));

        expect(redirectMock).toHaveBeenCalledTimes(1);
        expect(capturedRedirectUrl().pathname).toBe("/login");
        expect(nextMock).not.toHaveBeenCalled();
      },
    );

    it("includes the protected pathname as callbackUrl for a top-level route", async () => {
      await proxy(makeNextRequest("/projects"));

      const url = capturedRedirectUrl();
      expect(url.searchParams.get("callbackUrl")).toBe("/projects");
    });

    it("preserves nested paths in callbackUrl", async () => {
      await proxy(makeNextRequest("/projects/abc-123/board"));

      const url = capturedRedirectUrl();
      expect(url.searchParams.get("callbackUrl")).toBe("/projects/abc-123/board");
    });

    it("constructs the login redirect relative to the request base URL", async () => {
      await proxy(makeNextRequest("/settings"));

      expect(capturedRedirectUrl().origin).toBe(BASE_URL);
    });
  });

  describe("authenticated user on a protected route → NextResponse.next()", () => {
    beforeEach(() => {
      getTokenMock.mockResolvedValue(AUTHENTICATED_TOKEN);
    });

    it.each(["/projects", "/settings", "/team", "/projects/abc/board"])(
      "calls next() for '%s'",
      async (pathname) => {
        await proxy(makeNextRequest(pathname));

        expect(nextMock).toHaveBeenCalledTimes(1);
        expect(redirectMock).not.toHaveBeenCalled();
      },
    );
  });

  describe("unauthenticated user on a public auth route → NextResponse.next()", () => {
    beforeEach(() => {
      getTokenMock.mockResolvedValue(null);
    });

    it.each(["/" as const, "/login" as const, "/register" as const])(
      "calls next() for public route '%s'",
      async (pathname) => {
        await proxy(makeNextRequest(pathname));

        expect(nextMock).toHaveBeenCalledTimes(1);
        expect(redirectMock).not.toHaveBeenCalled();
      },
    );
  });

  describe("getToken invocation", () => {
    it("calls getToken exactly once per request with the request and NEXTAUTH_SECRET", async () => {
      getTokenMock.mockResolvedValue(null);
      const req = makeNextRequest("/");

      await proxy(req);

      expect(getTokenMock).toHaveBeenCalledExactlyOnceWith({
        req,
        secret: "test-secret-value-at-least-16-chars",
      });
    });

    it("reads the secret from serverEnv (not hardcoded)", async () => {
      getTokenMock.mockResolvedValue(null);

      await proxy(makeNextRequest("/"));

      const [callArgs] = getTokenMock.mock.calls;
      expect(callArgs?.[0].secret).toBe("test-secret-value-at-least-16-chars");
    });
  });
});

describe("config", () => {
  it("exports a matcher array", () => {
    expect(Array.isArray(config.matcher)).toBe(true);
  });

  it("has exactly one matcher entry", () => {
    expect(config.matcher).toHaveLength(1);
  });

  it("the matcher excludes /api routes", () => {
    const pattern = config.matcher[0] ?? "";
    expect(pattern).toContain("api");
  });

  it("the matcher excludes /trpc routes", () => {
    const pattern = config.matcher[0] ?? "";
    expect(pattern).toContain("trpc");
  });

  it("the matcher excludes _next/static assets", () => {
    const pattern = config.matcher[0] ?? "";
    expect(pattern).toContain("_next/static");
  });

  it("the matcher excludes _next/image optimization routes", () => {
    const pattern = config.matcher[0] ?? "";
    expect(pattern).toContain("_next/image");
  });

  it("the matcher excludes favicon.ico", () => {
    const pattern = config.matcher[0] ?? "";
    expect(pattern).toContain("favicon.ico");
  });

  it("the matcher uses a negative lookahead to exclude static file extensions", () => {
    // The `.*\\..*` segment skips any filename that has a dot (e.g., logo.png)
    const pattern = config.matcher[0] ?? "";
    // Verify the pattern contains some dot-extension exclusion logic
    expect(pattern).toMatch(/\.\*/);
  });
});
