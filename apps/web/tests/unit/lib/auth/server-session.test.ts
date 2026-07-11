import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database"));

import { makeHeaders, makeSessionHeaders, mockServerSessionUser } from "@/tests/helpers";
import { validateSessionToken } from "@/tests/mocks/taskflow-database";
import { getServerSessionFromHeaders } from "@/lib/auth/server-session";

describe("getServerSessionFromHeaders", () => {
  beforeEach(() => vi.clearAllMocks());

  // -- Null / early-exit cases (validateSessionToken is never called) --

  it("returns null when no cookie header is present", async () => {
    expect(await getServerSessionFromHeaders(makeHeaders())).toBeNull();
    expect(validateSessionToken).not.toHaveBeenCalled();
  });

  it("returns null when cookie header has no session token", async () => {
    expect(
      await getServerSessionFromHeaders(makeHeaders({ cookie: "theme=dark; lang=en" })),
    ).toBeNull();
    expect(validateSessionToken).not.toHaveBeenCalled();
  });

  it("returns null when cookie token value is empty string", async () => {
    expect(
      await getServerSessionFromHeaders(makeHeaders({ cookie: "next-auth.session-token=" })),
    ).toBeNull();
    expect(validateSessionToken).not.toHaveBeenCalled();
  });

  // -- Happy path --

  it("returns SessionUser on a valid session", async () => {
    vi.mocked(validateSessionToken).mockResolvedValueOnce(mockServerSessionUser);
    const result = await getServerSessionFromHeaders(makeSessionHeaders("valid-token"));
    expect(result).toEqual(mockServerSessionUser);
  });

  it("reads __Secure- prefixed token (HTTPS origin)", async () => {
    vi.mocked(validateSessionToken).mockResolvedValueOnce(mockServerSessionUser);
    await getServerSessionFromHeaders(makeSessionHeaders("secure-tok", true));
    expect(validateSessionToken).toHaveBeenCalledWith(expect.anything(), "secure-tok");
  });

  it("calls validateSessionToken with the exact extracted token", async () => {
    vi.mocked(validateSessionToken).mockResolvedValueOnce(mockServerSessionUser);
    await getServerSessionFromHeaders(makeSessionHeaders("my-token"));
    expect(validateSessionToken).toHaveBeenCalledOnce();
    expect(validateSessionToken).toHaveBeenCalledWith(expect.anything(), "my-token");
  });

  // -- Null cases where validateSessionToken IS called --

  it("returns null when validateSessionToken returns null (session not found or expired)", async () => {
    vi.mocked(validateSessionToken).mockResolvedValueOnce(null);
    expect(await getServerSessionFromHeaders(makeSessionHeaders("ghost"))).toBeNull();
  });

  it("returns null without throwing when validateSessionToken", async () => {
    vi.mocked(validateSessionToken).mockRejectedValueOnce(new Error("DB down"));
    expect(await getServerSessionFromHeaders(makeSessionHeaders("any"))).toBeNull();
  });

  it("returns null for a well-formed cookie when validateSessionToken rejects", async () => {
    vi.mocked(validateSessionToken).mockRejectedValueOnce(new Error("Connection refused"));
    const result = await getServerSessionFromHeaders(makeSessionHeaders("well-formed"));
    expect(result).toBeNull();
    // validateSessionToken WAS called - the null comes from the catch block, not early exit
    expect(validateSessionToken).toHaveBeenCalledOnce();
  });
});
