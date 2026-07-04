import { describe, expect, it } from "vitest";
import { parseCookieToken } from "../../src";

describe("parseCookieToken", () => {
  // -- Happy paths --

  it("extracts next-auth.session-token", () => {
    expect(parseCookieToken("next-auth.session-token=abc123")).toBe("abc123");
  });

  it("extracts token when surrounded by other cookies", () => {
    expect(parseCookieToken("theme=dark; next-auth.session-token=tok-xyz; lang=en")).toBe(
      "tok-xyz",
    );
  });

  it("extracts __Secure- prefixed token (HTTPS context)", () => {
    expect(parseCookieToken("__Secure-next-auth.session-token=secure-tok")).toBe("secure-tok");
  });

  it("prefers next-auth.session-token when both variants are present", () => {
    expect(
      parseCookieToken("next-auth.session-token=plain; __Secure-next-auth.session-token=secure"),
    ).toBe("plain");
  });

  it("extracts token with URI-encoded characters (cookie package decodes them)", () => {
    expect(parseCookieToken("next-auth.session-token=tok%2Fabc")).toBe("tok/abc");
  });

  // -- Null / empty cases --

  it("returns null when cookieHeader is null", () => {
    expect(parseCookieToken(null)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseCookieToken("")).toBeNull();
  });

  it("returns null when neither cookie name is present", () => {
    expect(parseCookieToken("theme=dark; lang=en")).toBeNull();
  });

  it("returns null when the token value is an empty string", () => {
    expect(parseCookieToken("next-auth.session-token=")).toBeNull();
  });
});
