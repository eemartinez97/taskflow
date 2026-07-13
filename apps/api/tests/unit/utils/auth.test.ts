import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JWT } from "@auth/core/jwt";

vi.mock("@taskflow/shared", () => ({ parseCookieToken: vi.fn() }));
vi.mock("@auth/core/jwt", () => ({ decode: vi.fn() }));
vi.mock("../../../src/config/env");

import { decode } from "@auth/core/jwt";
import { parseCookieToken } from "@taskflow/shared";
import { isProduction, env } from "../../../src/config/env";
import { getSessionUser, type AuthSession } from "../../../src/utils/auth";
import { VALID_USER } from "../../helpers";

// -- Typed mock references for IDE autocomplete and strict assertions --

const mockDecode = vi.mocked(decode);
const mockParseCookieToken = vi.mocked(parseCookieToken);
const mockIsProduction = vi.mocked(isProduction);

// -- Fixtures --

const RAW_COOKIE = "next-auth.session-token=abc123";
const EXTRACTED_TOKEN = "abc123";

// Primitive constants — single source of truth for both fixtures below

/** Minimal valid decoded JWT that satisfies the getSessionUser checks */
const VALID_DECODED_TOKEN: JWT = {
  sub: VALID_USER.id,
  name: VALID_USER.name,
  email: VALID_USER.email,
};

/** Expected AuthSession derived from VALID_DECODED_TOKEN */
const EXPECTED_SESSION: AuthSession = VALID_USER;

// -- Helpers --

/**
 * Sets up the happy-path mocks so individual tests only override
 * the specific mock they need to exercise. Keeps each `it` block minimal.
 *
 * Default state:
 *  - parseCookieToken  -> returns EXTRACTED_TOKEN
 *  - decode            -> returns VALID_DECODED_TOKEN
 *  - isProduction      -> returns false (dev environment)
 */
function setupHappyPath(): void {
  mockParseCookieToken.mockReturnValue(EXTRACTED_TOKEN);
  mockDecode.mockResolvedValue(VALID_DECODED_TOKEN);
  mockIsProduction.mockReturnValue(false);
}

/**
 * Asserts that decode() was called with the correct arguments.
 * Centralizes the assertion so changing the salt naming convention
 * only requires a single update here.
 */
function assertDecodeCalledWith(expectedSalt: string): void {
  expect(mockDecode).toHaveBeenCalledExactlyOnceWith({
    token: EXTRACTED_TOKEN,
    secret: env.NEXTAUTH_SECRET,
    salt: expectedSalt,
  });
}

describe("getSessionUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Early-exit guards --

  describe("when cookieHeader is absent", () => {
    it("returns null for undefined", async () => {
      expect(await getSessionUser(undefined)).toBeNull();
    });

    it("returns null for null", async () => {
      expect(await getSessionUser(null)).toBeNull();
    });

    it("returns null for empty string", async () => {
      mockParseCookieToken.mockReturnValue(null);
      expect(await getSessionUser("")).toBeNull();
    });

    it("never calls decode when header is absent", async () => {
      await getSessionUser(undefined);
      expect(mockDecode).not.toHaveBeenCalled();
    });
  });

  describe("when parseCookieToken returns null", () => {
    beforeEach(() => {
      mockParseCookieToken.mockReturnValue(null);
    });

    it("returns null", async () => {
      expect(await getSessionUser(RAW_COOKIE)).toBeNull();
    });

    it("never calls decode", async () => {
      await getSessionUser(RAW_COOKIE);
      expect(mockDecode).not.toHaveBeenCalled();
    });
  });

  // -- Salt selection --

  describe("salt selection", () => {
    it("uses the insecure cookie name in development", async () => {
      setupHappyPath();
      mockIsProduction.mockReturnValue(false);

      await getSessionUser(RAW_COOKIE);

      assertDecodeCalledWith("next-auth.session-token");
    });

    it("uses the __Secure- prefixed cookie name in production", async () => {
      setupHappyPath();
      mockIsProduction.mockReturnValue(true);

      await getSessionUser(RAW_COOKIE);

      assertDecodeCalledWith("__Secure-next-auth.session-token");
    });
  });

  // -- Happy path --

  describe("when the token is valid", () => {
    beforeEach(setupHappyPath);

    it("returns the correct AuthSession", async () => {
      expect(await getSessionUser(RAW_COOKIE)).toEqual(EXPECTED_SESSION);
    });

    it("passes raw cookie header through parseCookieToken", async () => {
      await getSessionUser(RAW_COOKIE);
      expect(mockParseCookieToken).toHaveBeenCalledExactlyOnceWith(RAW_COOKIE);
    });

    it("maps decoded.sub -> id", async () => {
      const result = await getSessionUser(RAW_COOKIE);
      expect(result?.id).toBe(VALID_DECODED_TOKEN.sub);
    });

    it("maps decoded.email -> email", async () => {
      const result = await getSessionUser(RAW_COOKIE);
      expect(result?.email).toBe(VALID_DECODED_TOKEN.email);
    });

    it("maps decoded.name -> name when present", async () => {
      const result = await getSessionUser(RAW_COOKIE);
      expect(result?.name).toBe(VALID_DECODED_TOKEN.name);
    });

    it("coerces undefined decoded.name to null", async () => {
      mockDecode.mockResolvedValue({ ...VALID_DECODED_TOKEN, name: undefined });
      const result = await getSessionUser(RAW_COOKIE);
      expect(result?.name).toBeNull();
    });
  });

  // -- Missing required JWT fields --

  describe("when decoded token is missing required fields", () => {
    beforeEach(setupHappyPath);

    it("returns null when decoded is null", async () => {
      mockDecode.mockResolvedValue(null);
      expect(await getSessionUser(RAW_COOKIE)).toBeNull();
    });

    it("returns null when sub is missing", async () => {
      mockDecode.mockResolvedValue({ email: "alice@taskflow.dev" });
      expect(await getSessionUser(RAW_COOKIE)).toBeNull();
    });

    it("returns null when email is missing", async () => {
      mockDecode.mockResolvedValue({ sub: "user-id-001" });
      expect(await getSessionUser(RAW_COOKIE)).toBeNull();
    });

    it("returns null when both sub and email are missing", async () => {
      mockDecode.mockResolvedValue({});
      expect(await getSessionUser(RAW_COOKIE)).toBeNull();
    });
  });

  // -- decode() throws --

  describe("when decode throws", () => {
    beforeEach(setupHappyPath);

    it("returns null on a generic error", async () => {
      mockDecode.mockRejectedValue(new Error("invalid signature"));
      expect(await getSessionUser(RAW_COOKIE)).toBeNull();
    });

    it("returns null on an expired token error", async () => {
      mockDecode.mockRejectedValue(new Error("jwt expired"));
      expect(await getSessionUser(RAW_COOKIE)).toBeNull();
    });

    it("returns null on a non-Error thrown value", async () => {
      mockDecode.mockRejectedValue("unexpected string error");
      expect(await getSessionUser(RAW_COOKIE)).toBeNull();
    });

    it("never propagates the error to the caller", async () => {
      mockDecode.mockRejectedValue(new Error("tampered"));
      await expect(getSessionUser(RAW_COOKIE)).resolves.not.toThrow();
    });
  });
});
