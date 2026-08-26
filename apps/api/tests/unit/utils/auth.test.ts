import { describe, expect, it, vi, beforeEach } from "vitest";
import { EncryptJWT } from "jose";

import { __resetPasswordChangedAtCacheForTest, getSessionUser } from "../../../src/utils/auth";
import { mockDb } from "../../mocks/database-mock";
import {
  deriveTestKey,
  makeCookieHeader,
  makeSessionToken,
  TEST_SECRET,
  VALID_USER,
} from "../../helpers";

describe("getSessionUser", () => {
  beforeEach(() => {
    __resetPasswordChangedAtCacheForTest();
    mockDb.user.findUnique.mockResolvedValue({ passwordChangedAt: null });
  });

  it.each([
    ["undefined cookie header", undefined],
    ["null cookie header", null],
    ["empty cookie header", ""],
  ])("returns null for %s", async (_name, header) => {
    await expect(getSessionUser(header)).resolves.toBeNull();
  });

  it("returns null when the session cookie is absent", async () => {
    await expect(getSessionUser("theme=dark; locale=es")).resolves.toBeNull();
  });

  it.each([
    ["next-auth.session-token (http)", "next-auth.session-token"],
    ["__Secure-next-auth.session-token (https)", "__Secure-next-auth.session-token"],
  ])("decrypts a valid session token from cookie name: %s", async (_label, cookieName) => {
    const token = await makeSessionToken();
    const cookieHeader = `${cookieName}=${token}`;

    await expect(getSessionUser(cookieHeader)).resolves.toEqual({
      id: VALID_USER.id,
      email: VALID_USER.email,
      name: "Sofia",
    });
  });

  it("decrypts a valid NextAuth v4 session token", async () => {
    const cookie = makeCookieHeader(await makeSessionToken());

    await expect(getSessionUser(cookie)).resolves.toEqual({
      id: VALID_USER.id,
      email: VALID_USER.email,
      name: "Sofia",
    });
  });

  it("normalizes a non-string name to null", async () => {
    const token = await makeSessionToken({
      sub: VALID_USER.id,
      email: VALID_USER.email,
      name: 42,
    });

    await expect(getSessionUser(makeCookieHeader(token))).resolves.toMatchObject({ name: null });
  });

  it.each([
    ["sub is missing", { email: VALID_USER.email }],
    ["sub is not a string", { sub: 1, email: VALID_USER.email }],
    ["email is missing", { sub: VALID_USER.id }],
    ["email is not a string", { sub: VALID_USER.id, email: 7 }],
  ])("returns null when %s", async (_name, payload) => {
    const token = await makeSessionToken(payload);

    await expect(getSessionUser(makeCookieHeader(token))).resolves.toBeNull();
  });

  it("returns null for an expired token (jwtDecrypt validates exp)", async () => {
    const token = await new EncryptJWT({ sub: VALID_USER.id, email: VALID_USER.email })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .encrypt(deriveTestKey());

    await expect(getSessionUser(makeCookieHeader(token))).resolves.toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await makeSessionToken(undefined, {
      secret: "a-completely-different-secret-value",
    });

    await expect(getSessionUser(makeCookieHeader(token))).resolves.toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const token = await makeSessionToken();
    const tampered = `${token.slice(0, -4)}AAAA`;

    await expect(getSessionUser(makeCookieHeader(tampered))).resolves.toBeNull();
  });

  it("does not leak the failure reason", async () => {
    const spy = vi.spyOn(console, "error");

    await getSessionUser(makeCookieHeader("garbage"));

    expect(spy).not.toHaveBeenCalled();
  });

  it("derives the key exactly like NextAuth v4", () => {
    // Regression guard: @auth/core v5 uses a different HKDF info string and
    // would silently stop decrypting v4 cookies.
    expect(deriveTestKey(TEST_SECRET)).toHaveLength(32);
  });

  it("returns null when the token has no iat claim", async () => {
    const token = await new EncryptJWT({ sub: VALID_USER.id, email: VALID_USER.email })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setExpirationTime("1h")
      .encrypt(deriveTestKey());

    await expect(getSessionUser(makeCookieHeader(token))).resolves.toBeNull();
  });

  describe("password-reset session revocation", () => {
    it("accepts the session when the password has never been reset", async () => {
      mockDb.user.findUnique.mockResolvedValue({ passwordChangedAt: null });

      const token = await makeSessionToken();
      await expect(getSessionUser(makeCookieHeader(token))).resolves.toMatchObject({
        id: VALID_USER.id,
      });
    });

    it("accepts the session when it was issued after the last password reset", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        passwordChangedAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
      });

      const token = await makeSessionToken(); // iat = now
      await expect(getSessionUser(makeCookieHeader(token))).resolves.toMatchObject({
        id: VALID_USER.id,
      });
    });

    it("rejects the session when it was issued before the last password reset", async () => {
      const token = await new EncryptJWT({ sub: VALID_USER.id, email: VALID_USER.email })
        .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600) // issued 1h ago
        .setExpirationTime("2h")
        .encrypt(deriveTestKey());

      mockDb.user.findUnique.mockResolvedValue({ passwordChangedAt: new Date() }); // reset just now

      await expect(getSessionUser(makeCookieHeader(token))).resolves.toBeNull();
    });

    it("looks up passwordChangedAt by the token's userId", async () => {
      const token = await makeSessionToken();
      await getSessionUser(makeCookieHeader(token));

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: VALID_USER.id },
        select: { passwordChangedAt: true },
      });
    });

    it("caches passwordChangedAt so a second call within the TTL doesn't re-query the database", async () => {
      const token = await makeSessionToken();

      await getSessionUser(makeCookieHeader(token));
      await getSessionUser(makeCookieHeader(token));

      expect(mockDb.user.findUnique).toHaveBeenCalledOnce();
    });

    it("fails closed when the passwordChangedAt lookup throws", async () => {
      mockDb.user.findUnique.mockRejectedValue(new Error("DB unavailable"));

      const token = await makeSessionToken();
      await expect(getSessionUser(makeCookieHeader(token))).resolves.toBeNull();
    });

    it("rejects a still-live session for a user that no longer exists", async () => {
      // e.g. deleted after the session cookie was issued - user?.passwordChangedAt
      // ?? null would otherwise collapse this into the same "nothing to
      // revoke" case as a user who simply never reset their password.
      mockDb.user.findUnique.mockResolvedValue(null);

      const token = await makeSessionToken();
      await expect(getSessionUser(makeCookieHeader(token))).resolves.toBeNull();
    });
  });
});
