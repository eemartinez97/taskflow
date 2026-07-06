import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../../src/config/env.js");

import { validateSession } from "../../../src/middleware/auth.js";
import {
  getNextError,
  makeMockNext,
  makeMockReq,
  makeMockRes,
  validateSessionToken,
  VALID_USER,
  makeSessionUser,
} from "../../helpers.js";

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

  it("calls next(401)  when no session cookie is present", async () => {
    const next = makeMockNext();
    await validateSession(makeMockReq({ headers: {} }), makeMockRes().res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(getNextError(next).statusCode).toBe(401);
    expect(validateSessionToken).not.toHaveBeenCalled();
  });

  it("attaches user to req and calls next() on a valid session", async () => {
    validateSessionToken.mockResolvedValueOnce(makeSessionUser());
    const req = makeReqWithToken("valid-token");
    const next = makeMockNext();

    await validateSession(req, makeMockRes().res, next);

    expect(next).toHaveBeenCalledWith(); // called with no args = success
    expect(req.user).toEqual({ id: VALID_USER.id, email: VALID_USER.email });
  });

  it("reads __Secure- cookie for https origins", async () => {
    const token = "secure-token";
    validateSessionToken.mockResolvedValueOnce(makeSessionUser());

    const req = makeMockReq({
      headers: { cookie: `__Secure-next-auth.session-token=${token}` },
    });
    const next = makeMockNext();

    await validateSession(req, makeMockRes().res, next);

    expect(next).toHaveBeenCalledWith();
    expect(validateSessionToken).toHaveBeenCalledWith(
      expect.anything(), // prisma instance
      token,
    );
  });

  it("queries with the correct select shape (user fields only)", async () => {
    const token = "shape-test-token";
    validateSessionToken.mockResolvedValueOnce(makeSessionUser());

    await validateSession(makeReqWithToken(token), makeMockRes().res, makeMockNext());

    expect(validateSessionToken).toHaveBeenCalledWith(expect.anything(), token);
  });

  it("calls next(401) when session is not found in DB", async () => {
    const next = makeMockNext();

    await validateSession(makeReqWithToken("missing-token"), makeMockRes().res, next);

    expect(getNextError(next).statusCode).toBe(401);
    expect(getNextError(next).code).toBe("SESSION_EXPIRED");
  });

  it("calls next(401) when session is expired", async () => {
    // validateSessionToken already handles expiry and returns null for expired sessions
    validateSessionToken.mockResolvedValueOnce(null);
    const next = makeMockNext();

    await validateSession(makeReqWithToken("expired-token"), makeMockRes().res, next);

    expect(getNextError(next).statusCode).toBe(401);
  });

  it("passes the raw DB error to next() on unexpected Prisma failure", async () => {
    const dbError = new Error("Connection refused");
    validateSessionToken.mockRejectedValueOnce(dbError);
    const next = makeMockNext();

    await validateSession(makeReqWithToken("any-token"), makeMockRes().res, next);

    // The catch block passes the raw DB error to next()
    expect(vi.mocked(next).mock.calls[0]?.[0]).toBe(dbError);
  });
});
