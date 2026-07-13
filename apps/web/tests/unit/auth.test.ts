import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { CredentialsConfig } from "next-auth/providers/credentials";

vi.mock("@taskflow/database", () => ({
  prisma: { __isMockPrisma: true },
}));

vi.mock("@/lib/auth/credentials", () => ({
  authorizeCredentials: vi.fn(),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: CredentialsConfig) => config,
}));

import { authOptions } from "@/auth";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { prisma } from "@taskflow/database";
import { serverEnv } from "@/lib/env.server";
import { mockAuthorizedUser } from "@/tests/helpers";

// -- Fixtures --

const credentialsProvider = authOptions.providers[0] as CredentialsConfig;

/** Extracts the type of the second argument of `authorize` (RequestInternal) */
type AuthorizeReq = Parameters<CredentialsConfig["authorize"]>[1];
const noopReq = {} as AuthorizeReq;

/** Type helper for callback arguments */
type CallbackParams<T> = T extends (...args: infer U) => unknown ? U : never;

/** Builds a fresh Session object for session-callback tests. */
function makeSession(): Session {
  return {
    user: { name: "Alice", email: "alice@taskflow.dev", image: null },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session;
}

describe("configuration", () => {
  it("uses JWT session strategy", () => {
    expect(authOptions.session).toEqual({ strategy: "jwt" });
  });

  it("configures custom auth pages", () => {
    expect(authOptions.pages).toEqual({
      signIn: "/login",
      error: "/login",
    });
  });

  it("uses NEXTAUTH_SECRET from serverEnv as the secret", () => {
    expect(authOptions.secret).toBe(serverEnv.NEXTAUTH_SECRET);
  });

  it("registers exactly one Credentials provider", () => {
    expect(authOptions.providers).toHaveLength(1);
    expect(credentialsProvider.name).toBe("Credentials");
  });

  it("declares email and password credential fields", () => {
    expect(credentialsProvider.credentials).toEqual({
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    });
  });
});

describe("authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when authorizeCredentials returns null", async () => {
    vi.mocked(authorizeCredentials).mockResolvedValue(null);

    const result = await credentialsProvider.authorize(
      { email: "alice@taskflow.dev", password: "wrong" },
      noopReq,
    );

    expect(result).toBeNull();
  });

  it("returns a NextAuth User shape when authorizeCredentials succeeds", async () => {
    vi.mocked(authorizeCredentials).mockResolvedValue(mockAuthorizedUser);

    const result = await credentialsProvider.authorize(
      { email: "alice@taskflow.dev", password: "correct-password" },
      noopReq,
    );

    expect(result).toEqual({
      id: mockAuthorizedUser.id,
      email: mockAuthorizedUser.email,
      name: mockAuthorizedUser.name,
      image: mockAuthorizedUser.image,
    });
  });

  it("strips extra fields (e.g. password hash) from the returned User", async () => {
    vi.mocked(authorizeCredentials).mockResolvedValue({
      ...mockAuthorizedUser,
      password: "hashed-leak",
      extraField: "leak",
    } as typeof mockAuthorizedUser & { password: string; extraField: string });

    const result = await credentialsProvider.authorize(
      { email: "alice@taskflow.dev", password: "correct" },
      noopReq,
    );

    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("extraField");
  });

  it("forwards prisma and credentials to authorizeCredentials", async () => {
    vi.mocked(authorizeCredentials).mockResolvedValue(null);

    const creds = { email: "alice@taskflow.dev", password: "secret" };
    await credentialsProvider.authorize(creds, noopReq);

    expect(authorizeCredentials).toHaveBeenCalledWith(prisma, creds);
  });

  it("falls back to {} when credentials is undefined", async () => {
    vi.mocked(authorizeCredentials).mockResolvedValue(null);

    const undefinedCreds = undefined as unknown as Parameters<
      typeof credentialsProvider.authorize
    >[0];

    // NextAuth may pass undefined when the form is submitted without fields
    await credentialsProvider.authorize(undefinedCreds, noopReq);

    expect(authorizeCredentials).toHaveBeenCalledWith(prisma, {});
  });
});

describe("jwt callback", () => {
  const jwt = authOptions.callbacks?.jwt;
  if (!jwt) throw new Error("jwt callback not configured");

  it("persists user.id onto token on initial sign-in", () => {
    const token = {} as JWT;
    const user = { id: "user-123" } as User;

    const args = {
      token,
      user,
      account: null,
      isNewUser: false,
    } as unknown as CallbackParams<typeof jwt>[0];

    const result = jwt(args) as JWT;

    expect(result.id).toBe("user-123");
  });

  it("preserves existing token.id on subsequent calls (user absent)", () => {
    const token = { id: "persisted-id" } as JWT;

    const args = {
      token,
      user: undefined,
      account: null,
    } as unknown as CallbackParams<typeof jwt>[0];

    const result = jwt(args) as JWT;

    expect(result.id).toBe("persisted-id");
  });
});

describe("session callback", () => {
  const sessionCb = authOptions.callbacks?.session;
  if (!sessionCb) throw new Error("session callback not configured");

  it("attaches token.id to session.user.id", () => {
    const token = { id: "token-user-id" } as JWT;

    const args = {
      session: makeSession(),
      token,
      user: {} as User,
    } as unknown as CallbackParams<typeof sessionCb>[0];

    const result = sessionCb(args) as Session & { user: { id?: string } };

    expect(result.user.id).toBe("token-user-id");
  });

  it("does not set session.user.id when token.id is absent", () => {
    const token = {} as JWT;

    const args = {
      session: makeSession(),
      token,
      user: {} as User,
    } as unknown as CallbackParams<typeof sessionCb>[0];

    const result = sessionCb(args) as Session & { user: { id?: string } };

    expect(result.user.id).toBeUndefined();
  });
});
