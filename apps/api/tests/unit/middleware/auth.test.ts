import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../../src/config/env.js");

// Mock error-handler to avoid importing env/logger chains
vi.mock("../../../src/middleware/error-handler.js", () => ({
  createError: vi.fn((message: string, statusCode: number, code?: string) => {
    const err = new Error(message) as Error & { statusCode: number; code?: string };
    err.statusCode = statusCode;
    if (code !== undefined) err.code = code;
    return err;
  }),
}));

import type { Session, User } from "@taskflow/database";
import { getNextError, makeMockNext, makeMockReq, makeMockRes, VALID_USER } from "../../helpers.js";
import { validateSession } from "../../../src/middleware/auth.js";
import { mockDb } from "../../mocks/database-mock.js";

/** Session that expires far in the future */
function makeValidSession(token: string): Session & { user: Pick<User, "id" | "email"> } {
  return {
    id: "session-id-1",
    sessionToken: token,
    userId: VALID_USER.id,
    expires: new Date(Date.now() + 1000 * 60 * 60), // +1 hour
    user: VALID_USER,
  };
}

describe("validateSession middleware", () => {
  beforeEach(() => vi.resetAllMocks());

  it("calls next(error) with 401 when no session cookie is present", async () => {
    const next = makeMockNext();
    await validateSession(makeMockReq({ cookies: {} }), makeMockRes().res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(getNextError(next).statusCode).toBe(401);
    expect(mockDb.session.findUnique).not.toHaveBeenCalled();
  });

  it("reads the next-auth.session-token cookie and attaches user to req", async () => {
    const token = "valid-session-token";
    mockDb.session.findUnique.mockResolvedValueOnce(makeValidSession(token));
    const req = makeMockReq({ cookies: { "next-auth.session-token": token } });
    const next = makeMockNext();

    await validateSession(req, makeMockRes().res, next);

    expect(next).toHaveBeenCalledWith(); // called with no args = success
    expect(req.user).toEqual({ id: VALID_USER.id, email: VALID_USER.email });
  });

  it("reads __Secure- cookie when the plain one is absent", async () => {
    const token = "secure-token";
    mockDb.session.findUnique.mockResolvedValueOnce(makeValidSession(token));
    const next = makeMockNext();

    await validateSession(
      makeMockReq({ cookies: { "__Secure-next-auth.session-token": token } }),
      makeMockRes().res,
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });

  it("queries DB with the correct sessionToken", async () => {
    const token = "lookup-token";
    mockDb.session.findUnique.mockResolvedValueOnce(makeValidSession(token));

    await validateSession(
      makeMockReq({ cookies: { "next-auth.session-token": token } }),
      makeMockRes().res,
      makeMockNext(),
    );

    expect(mockDb.session.findUnique).toHaveBeenCalledWith({
      where: { sessionToken: token },
      include: { user: true },
    });
  });

  it("calls next(error) with 401 when session is not found in DB", async () => {
    mockDb.session.findUnique.mockResolvedValueOnce(null);
    const next = makeMockNext();

    await validateSession(
      makeMockReq({ cookies: { "next-auth.session-token": "ghost-token" } }),
      makeMockRes().res,
      next,
    );

    expect(getNextError(next).statusCode).toBe(401);
  });

  it("calls next(error) with 401 when session is expired", async () => {
    mockDb.session.findUnique.mockResolvedValueOnce({
      ...makeValidSession("expired-token"),
      expires: new Date(Date.now() - 1000), // 1 second in the past
    });
    const next = makeMockNext();

    await validateSession(
      makeMockReq({ cookies: { "next-auth.session-token": "expired-token" } }),
      makeMockRes().res,
      next,
    );

    expect(getNextError(next).statusCode).toBe(401);
  });

  it("calls next(rawError) when prisma throws an unexpected error", async () => {
    const dbError = new Error("Connection refused");
    mockDb.session.findUnique.mockRejectedValueOnce(dbError);
    const next = makeMockNext();

    await validateSession(
      makeMockReq({ cookies: { "next-auth.session-token": "any-token" } }),
      makeMockRes().res,
      next,
    );

    // The catch block passes the raw DB error to next()
    expect(vi.mocked(next).mock.calls[0]?.[0]).toBe(dbError);
  });
});
