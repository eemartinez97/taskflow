import { describe, expect, it, vi } from "vitest";
import { EncryptJWT } from "jose";

import { getSessionUser } from "../../../src/utils/auth";
import {
  deriveTestKey,
  makeCookieHeader,
  makeSessionToken,
  TEST_SECRET,
  VALID_USER,
} from "../../helpers";

describe("getSessionUser", () => {
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
});
