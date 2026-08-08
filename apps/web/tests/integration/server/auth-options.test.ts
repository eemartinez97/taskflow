import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { User } from "next-auth";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { authorizeCredentials } from "@/lib/auth/credentials";

// -- Module mocks --
vi.mock("@taskflow/database", async () => await import("@/tests/mocks/taskflow-database"));
vi.mock(
  "next-auth/providers/credentials",
  async () => await import("@/tests/mocks/next-auth-provider"),
);
vi.mock("@/lib/auth/credentials", () => ({
  authorizeCredentials: vi.fn(),
}));
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    NEXTAUTH_SECRET: "test-secret-value-at-least-16-chars",
    NEXTAUTH_URL: "http://localhost:3000",
    NODE_ENV: "test" as const,
    DATABASE_URL: "postgresql://test",
  },
}));

import { authOptions } from "@/auth";
import { mockDb } from "@/tests/mocks/taskflow-database";
import { __resetSessionRevocationCacheForTest } from "@/lib/auth/session-revocation";

// Typed helpers - cast to a simpler signature to avoid NextAuth's
// internal overloaded callback types.
interface JwtParams {
  token: JWT;
  user?: User | null;
  trigger?: "signIn" | "signUp" | "update";
  session?: { name?: string | null; image?: string | null };
  account?: null;
}
interface SessionParams {
  session: Session;
  token: JWT;
}

const invokeJwt = (params: JwtParams): JWT => {
  const jwtCallback = authOptions.callbacks?.jwt;
  if (!jwtCallback) throw new Error("authOptions.callbacks.jwt is not defined.");
  return (jwtCallback as (p: JwtParams) => JWT)(params);
};

const invokeSession = async (params: SessionParams): Promise<Session> => {
  const sessionCallback = authOptions.callbacks?.session;
  if (!sessionCallback) throw new Error("authOptions.callbacks.session is not defined.");
  return (sessionCallback as (p: SessionParams) => Promise<Session>)(params);
};

function getProvider(): {
  authorize: (creds: Partial<Record<string, string>> | undefined) => Promise<User | null>;
} {
  const provider = authOptions.providers[0];
  if (!provider) throw new Error("CredentialsProvider is not configured in authOptions.");
  return provider as unknown as {
    authorize: (creds: Partial<Record<string, string>> | undefined) => Promise<User | null>;
  };
}

const mockAuthorize = vi.mocked(authorizeCredentials);

// -- Tests --
describe("authOptions", () => {
  // -- CredentialsProvider.authorize --

  describe("CredentialsProvider.authorize", () => {
    beforeEach(() => {
      mockAuthorize.mockResolvedValue(null);
    });

    it("returns null when authorizeCredentials returns null", async () => {
      const result = await getProvider().authorize({ email: "x@x.com", password: "wrong" });

      expect(result).toBeNull();
    });

    it("returns a NextAuth User object when credentials are valid", async () => {
      const sessionUser = {
        id: "user-123",
        email: "alice@taskflow.dev",
        name: "Alice",
        image: null,
      };
      mockAuthorize.mockResolvedValue(sessionUser);

      const result = await getProvider().authorize({
        email: "alice@taskflow.dev",
        password: "Secure@Password1",
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe("user-123");
      expect(result?.email).toBe("alice@taskflow.dev");
    });

    it("passes prisma and the raw credentials to authorizeCredentials", async () => {
      const creds = { email: "alice@taskflow.dev", password: "Secure@Password1" };
      await getProvider().authorize(creds);

      expect(mockAuthorize).toHaveBeenCalledWith(
        expect.anything(), // prisma instance
        creds,
      );
    });

    it("returns null when credentials are undefined", async () => {
      const result = await getProvider().authorize(undefined);

      expect(result).toBeNull();
    });
  });

  // -- jwt callback --

  describe("jwt callback", () => {
    it("persists user.id onto the token during sign-in", () => {
      const token: JWT = { sub: "sub-xyz" };
      const user: User = { id: "user-abc", email: "alice@test.com", name: "Alice" };

      const result = invokeJwt({ token, user, trigger: "signIn" });

      expect(result.id).toBe("user-abc");
    });

    it("preserves the existing token.id on subsequent calls (user absent)", () => {
      const token: JWT = { sub: "sub-xyz", id: "user-abc" };

      const result = invokeJwt({ token });

      expect(result.id).toBe("user-abc");
      expect(result.sub).toBe("sub-xyz");
    });

    it("updates token.name when trigger is 'update' with a session name", () => {
      const token: JWT = { sub: "s", id: "u", name: "Old Name" };

      const result = invokeJwt({
        token,
        trigger: "update",
        session: { name: "New Name", image: null },
      });

      expect(result.name).toBe("New Name");
    });

    it("updates token.picture when trigger is 'update' with a session image", () => {
      const token: JWT = { sub: "s", id: "u" };

      const result = invokeJwt({
        token,
        trigger: "update",
        session: { image: "https://cdn.example.com/avatar.png" },
      });

      expect(result.picture).toBe("https://cdn.example.com/avatar.png");
    });

    it("leaves the token unchanged when trigger is 'update' but session is absent", () => {
      const token: JWT = { sub: "s", id: "u", name: "Alice" };

      const result = invokeJwt({ token, trigger: "update" });

      expect(result.name).toBe("Alice");
    });

    it("does not set id when signUp trigger provides no user (defensive)", () => {
      const token: JWT = { sub: "s" };

      const result = invokeJwt({ token, trigger: "signUp" });

      expect(result.id).toBeUndefined();
    });

    it("does not update token.picture when session.image is explicitly undefined", () => {
      const token: JWT = { sub: "s", id: "u", picture: "old-pic-url" };

      const result = invokeJwt({
        token,
        trigger: "update",
        session: { name: "New Name" },
      });

      expect(result.picture).toBe("old-pic-url");
    });
  });

  // -- cookies config (COOKIE_DOMAIN) --

  describe("cookies config", () => {
    afterEach(() => {
      vi.doUnmock("@/lib/env.server");
      vi.resetModules();
    });

    it("does not set a cookies config when COOKIE_DOMAIN is unset", () => {
      expect(authOptions.cookies).toBeUndefined();
    });

    // Regression test: `name` and `secure` used to be derived independently
    // (name from NEXTAUTH_URL directly, secure left to NextAuth's own
    // default). A `__Secure-`-prefixed cookie WITHOUT the `Secure` attribute
    // is invalid per spec and silently dropped by every browser - no error
    // anywhere. Login appeared to hang forever in production: the server
    // logged 200 for every step, but the client never received a usable
    // session cookie. Asserting both together in the same expectation is
    // what catches that mismatch.
    it("uses the __Secure- cookie name and sets domain when COOKIE_DOMAIN is set and NEXTAUTH_URL is https", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env.server", () => ({
        serverEnv: {
          NEXTAUTH_SECRET: "test-secret-value-at-least-16-chars",
          NEXTAUTH_URL: "https://app.taskflow.dev",
          NODE_ENV: "test" as const,
          DATABASE_URL: "postgresql://test",
          COOKIE_DOMAIN: ".taskflow.dev",
        },
      }));

      const { authOptions: opts } = await import("@/auth");

      expect(opts.cookies?.sessionToken?.name).toBe("__Secure-next-auth.session-token");
      expect(opts.cookies?.sessionToken?.options).toMatchObject({
        domain: ".taskflow.dev",
        secure: true,
      });
    });

    it("uses the plain cookie name and secure:false when COOKIE_DOMAIN is set but NEXTAUTH_URL is not https", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env.server", () => ({
        serverEnv: {
          NEXTAUTH_SECRET: "test-secret-value-at-least-16-chars",
          NEXTAUTH_URL: "http://localhost:3000",
          NODE_ENV: "test" as const,
          DATABASE_URL: "postgresql://test",
          COOKIE_DOMAIN: ".taskflow.dev",
        },
      }));

      const { authOptions: opts } = await import("@/auth");

      expect(opts.cookies?.sessionToken?.name).toBe("next-auth.session-token");
      expect(opts.cookies?.sessionToken?.options).toMatchObject({ secure: false });
    });
  });

  // -- session callback --

  describe("session callback", () => {
    const makeSession = (): Session => ({
      user: { id: "", name: "Alice", email: "alice@test.com", image: null },
      expires: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const nowSeconds = Math.floor(Date.now() / 1000);

    beforeEach(() => {
      __resetSessionRevocationCacheForTest();
      mockDb.user.findUnique.mockResolvedValue({ passwordChangedAt: null });
    });

    it("attaches token.id to session.user.id when the token carries an id and iat", async () => {
      const token: JWT = { sub: "s", id: "user-abc", iat: nowSeconds };

      const result = await invokeSession({ session: makeSession(), token });

      expect(result.user.id).toBe("user-abc");
    });

    it("does not modify session.user.id when the token has no id", async () => {
      const session = makeSession();
      session.user.id = "original-id";
      const token: JWT = { sub: "s", iat: nowSeconds }; // no id claim

      const result = await invokeSession({ session, token });

      expect(result.user.id).toBe("original-id");
    });

    it("returns the session object (even when token.id is absent)", async () => {
      const session = makeSession();
      const token: JWT = { sub: "s", iat: nowSeconds };

      const result = await invokeSession({ session, token });

      expect(result).toBe(session);
    });

    it("leaves session.user.id unset when the token has no iat claim (fail closed)", async () => {
      const token: JWT = { sub: "s", id: "user-abc" }; // no iat claim

      const result = await invokeSession({ session: makeSession(), token });

      expect(result.user.id).toBe("");
    });

    it("leaves session.user.id unset when the token predates the user's last password reset", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        passwordChangedAt: new Date((nowSeconds + 60) * 1000),
      });
      const token: JWT = { sub: "s", id: "user-abc", iat: nowSeconds };

      const result = await invokeSession({ session: makeSession(), token });

      expect(result.user.id).toBe("");
    });

    it("attaches token.id when the token was issued after the user's last password reset", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        passwordChangedAt: new Date((nowSeconds - 60) * 1000),
      });
      const token: JWT = { sub: "s", id: "user-abc", iat: nowSeconds };

      const result = await invokeSession({ session: makeSession(), token });

      expect(result.user.id).toBe("user-abc");
    });
  });
});
