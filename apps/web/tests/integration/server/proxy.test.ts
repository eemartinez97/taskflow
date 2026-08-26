import { describe, it, expect, vi, beforeEach } from "vitest";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { proxy } from "@/proxy";
import { makeRequest } from "../helpers/request";

// -- Module mocks --
vi.mock("next-auth/jwt", async () => await import("@/tests/mocks/next-auth-jwt"));

// env.server is imported by proxy.ts; real env vars are set in tests/setup/env.ts
// but we mock it here to prevent the module-level parseServerEnv() side-effect
// from depending on the test environment's process.env ordering.
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    NEXTAUTH_SECRET: "test-secret-value-at-least-16-chars",
    NEXTAUTH_URL: "http://localhost:3000",
    NODE_ENV: "test" as const,
    DATABASE_URL: "postgresql://test",
  },
}));

// -- Helpers --
const mockGetToken = vi.mocked(getToken);

/** A minimal valid JWT payload used to simulate an authenticated user. */
const AUTHED_TOKEN: JWT = {
  sub: "user-123",
  id: "user-123",
  email: "alice@taskflow.dev",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  jti: "test-jti",
};

/** Returns the Location header value from a redirect response, or null. */
function location(res: Response): string | null {
  return res.headers.get("location");
}

// -- Tests --
describe("proxy middleware", () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue(null); // unauthenticated by default
  });

  // -- Authenticated user --

  describe("authenticated user", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue(AUTHED_TOKEN);
    });

    it.each(["/", "/login", "/register"])(
      "redirects %s to /projects (public auth route guard)",
      async (path) => {
        const res = await proxy(makeRequest(path));

        expect(res.status).toBe(307);
        expect(location(res)).toContain("/projects");
      },
    );

    it.each(["/verify-email", "/forgot-password", "/reset-password"])(
      "passes through always-accessible route %s without redirecting (authed)",
      async (path) => {
        const res = await proxy(makeRequest(path));

        expect(location(res)).toBeNull();
      },
    );

    it.each(["/projects", "/settings", "/team", "/invitations/raw-token", "/tasks"])(
      "passes through protected route %s without redirecting",
      async (path) => {
        const res = await proxy(makeRequest(path));

        expect(location(res)).toBeNull();
      },
    );

    it("redirects /organizations to /team", async () => {
      const res = await proxy(makeRequest("/organizations"));

      expect(res.status).toBe(307);
      expect(location(res)).toContain("/team");
    });

    it("redirects /organizations/<orgId> to /team and sets the active-org cookie", async () => {
      const res = await proxy(makeRequest("/organizations/org-1"));

      expect(res.status).toBe(307);
      expect(location(res)).toContain("/team");
      expect(res.cookies.get("taskflow.activeOrgId")?.value).toBe("org-1");
    });

    it("tags the /team redirect with ?from=<orgId> so /team can detect a stale deep link", async () => {
      const res = await proxy(makeRequest("/organizations/org-1"));

      expect(location(res)).toContain("from=org-1");
    });

    it("redirects /register?invite=<token> to /invitations/<token> instead of /projects", async () => {
      const res = await proxy(makeRequest("/register?invite=raw-token"));

      expect(res.status).toBe(307);
      expect(location(res)).toContain("/invitations/raw-token");
    });

    it("redirects a plain /register (no invite token) to /projects as usual", async () => {
      const res = await proxy(makeRequest("/register"));

      expect(res.status).toBe(307);
      expect(location(res)).toContain("/projects");
    });
  });

  // -- Unauthenticated user --

  describe("unauthenticated user", () => {
    it.each(["/", "/login", "/register"])(
      "passes through public route %s without redirecting",
      async (path) => {
        const res = await proxy(makeRequest(path));

        expect(location(res)).toBeNull();
      },
    );

    it.each([
      ["/projects", "%2Fprojects"],
      ["/settings", "%2Fsettings"],
      ["/team", "%2Fteam"],
      ["/organizations", "%2Forganizations"],
      ["/organizations/org-1", "%2Forganizations%2Forg-1"],
      ["/tasks", "%2Ftasks"],
    ])("redirects %s to /login with the correct callbackUrl", async (path, encodedPath) => {
      const res = await proxy(makeRequest(path));
      const loc = location(res) ?? "";

      expect(res.status).toBe(307);
      expect(loc).toContain("/login");
      expect(loc).toContain(`callbackUrl=${encodedPath}`);
    });

    it.each(["/verify-email", "/forgot-password", "/reset-password"])(
      "passes through always-accessible route %s without redirecting (unauthed)",
      async (path) => {
        const res = await proxy(makeRequest(path));

        expect(location(res)).toBeNull();
      },
    );
  });
});
