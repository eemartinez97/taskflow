import { describe, expect, it } from "vitest";
import { parseCookieToken } from "../../../src/utils/cookies.js";

describe("parseCookieToken", () => {
  it("extracts next-auth.session-token from a single-cookie header", () => {
    expect(parseCookieToken("next-auth.session-token=abc123")).toBe("abc123");
  });

  it("extracts token when surrounded by other cookies", () => {
    expect(parseCookieToken("theme=dark; next-auth.session-token=tok-xyz; lang=en")).toBe(
      "tok-xyz",
    );
  });

  it("extracts __Secure- prefixed token (https context)", () => {
    expect(parseCookieToken("__Secure-next-auth.session-token=secure-tok")).toBe("secure-tok");
  });

  it("prefers next-auth.session-token over __Secure when both are present", () => {
    expect(
      parseCookieToken("next-auth.session-token=plain; __Secure-next-auth.session-token=secure"),
    ).toBe("plain");
  });

  it("returns null when neither cookie name is present", () => {
    expect(parseCookieToken("theme=dark; lang=en")).toBeNull();
  });

  it("returns null for empty cookie string", () => {
    expect(parseCookieToken("")).toBeNull();
  });

  it("returns null when the token value is empty", () => {
    expect(parseCookieToken("next-auth.session-token=")).toBeNull();
  });

  it("handles extra whitespace around name and value", () => {
    expect(parseCookieToken(" next-auth.session-token = tok-ws ")).toBe("tok-ws");
  });

  it("ignores cookie pairs without an equals sign", () => {
    expect(parseCookieToken("malformed; next-auth.session-token=good")).toBe("good");
  });

  it("handles cookie value that contains an equal sign (e.g. base64)", () => {
    const b64 = "dG9rZW4=";
    expect(parseCookieToken(`next-auth.session-token=${b64}`)).toBe(b64);
  });

  it("returns the first marching token when both cookie names are present", () => {
    expect(
      parseCookieToken("next-auth.session-token=plain; __Secure-next-auth.session-token=secure"),
    ).toBe("plain");
  });

  it("returns null for a header with only the path/domain attributes", () => {
    expect(parseCookieToken("Path=/; HttpOnly")).toBeNull();
  });
});
