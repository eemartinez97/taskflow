import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../../src/utils/auth", () => ({
  getSessionUser: vi.fn(),
}));
vi.mock("../../../src/config/env");

import {
  getNextError,
  makeMockNext,
  makeMockReq,
  makeMockRes,
  VALID_USER,
  makeSessionUser,
} from "../../helpers";
import { validateSession } from "../../../src/middleware/auth";
import { getSessionUser } from "../../../src/utils/auth";

/**
 * Builds a request with a Cookie header containing the given token.
 * Uses the http cookie name - server.test.ts covers the __Secure- variant.
 */
function makeReqWithToken(token: string): ReturnType<typeof makeMockReq> {
  return makeMockReq({
    headers: { cookie: `next-auth.session-token=${token}` },
  });
}

describe("validateSession middleware", () => {
  beforeEach(() => vi.resetAllMocks());

  it("calls next(401) when no session cookie is present", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);
    const next = makeMockNext();

    await validateSession(makeMockReq({ headers: {} }), makeMockRes().res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(getNextError(next).statusCode).toBe(401);
    expect(getNextError(next).code).toBe("UNAUTHORIZED");
  });

  it("attaches user to req and calls next() on a valid session", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(makeSessionUser());
    const req = makeReqWithToken("valid-token");
    const next = makeMockNext();

    await validateSession(req, makeMockRes().res, next);

    expect(next).toHaveBeenCalledWith(); // called with no args = success
    expect(req.user).toEqual({ id: VALID_USER.id, email: VALID_USER.email });
  });

  it("reads __Secure- cookie for https origins", async () => {
    const token = "secure-token";
    const cookieHeader = `__Secure-next-auth.session-token=${token}`;
    vi.mocked(getSessionUser).mockResolvedValueOnce(makeSessionUser());

    const req = makeMockReq({
      headers: { cookie: cookieHeader },
    });
    const next = makeMockNext();

    await validateSession(req, makeMockRes().res, next);

    expect(next).toHaveBeenCalledWith();
    expect(getSessionUser).toHaveBeenCalledWith(cookieHeader);
  });

  it("passes the raw cookie header to getSessionUser", async () => {
    const token = "shape-test-token";
    const cookieHeader = `next-auth.session-token=${token}`;
    vi.mocked(getSessionUser).mockResolvedValueOnce(makeSessionUser());

    await validateSession(makeReqWithToken(token), makeMockRes().res, makeMockNext());

    expect(getSessionUser).toHaveBeenCalledWith(cookieHeader);
  });

  it("calls next(401) when session is invalid or JWT verification fails", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);
    const next = makeMockNext();

    await validateSession(makeReqWithToken("missing-or-tampered-token"), makeMockRes().res, next);

    expect(getNextError(next).statusCode).toBe(401);
    expect(getNextError(next).code).toBe("UNAUTHORIZED");
  });

  it("passes the raw error to next() on unexpected failure", async () => {
    const authError = new Error("JWT decode crashed");
    vi.mocked(getSessionUser).mockRejectedValueOnce(authError);
    const next = makeMockNext();

    await validateSession(makeReqWithToken("any-token"), makeMockRes().res, next);

    // The catch block passes the raw error to next()
    expect(vi.mocked(next).mock.calls[0]?.[0]).toBe(authError);
  });
});
