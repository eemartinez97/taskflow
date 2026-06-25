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

import {
  getNextError,
  makeMockNext,
  makeMockReq,
  makeMockRes,
  makeValidSessionRow,
  VALID_USER,
} from "../../helpers.js";
import { validateSession } from "../../../src/middleware/auth.js";
import { mockDb } from "../../mocks/database-mock.js";

describe("validateSession middleware", () => {
  beforeEach(() => vi.resetAllMocks());

  it("calls next(401)  when no session cookie is present", async () => {
    const next = makeMockNext();
    await validateSession(makeMockReq({ headers: {} }), makeMockRes().res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(getNextError(next).statusCode).toBe(401);
    expect(mockDb.session.findUnique).not.toHaveBeenCalled();
  });

  it("attaches user to req and calls next() on a valid session", async () => {
    const token = "valid-session-token";
    mockDb.session.findUnique.mockResolvedValueOnce(makeValidSessionRow(token));

    const req = makeMockReq({ headers: { cookie: `next-auth.session-token=${token}` } });
    const next = makeMockNext();

    await validateSession(req, makeMockRes().res, next);

    expect(next).toHaveBeenCalledWith(); // called with no args = success
    expect(req.user).toEqual({ id: VALID_USER.id, email: VALID_USER.email });
  });

  it("reads __Secure- cookie for https origins", async () => {
    const token = "secure-token";
    mockDb.session.findUnique.mockResolvedValueOnce(makeValidSessionRow(token));

    const req = makeMockReq({
      headers: { cookie: `__Secure-next-auth.session-token=${token}` },
    });

    await validateSession(req, makeMockRes().res, makeMockNext());

    expect(mockDb.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionToken: token } }),
    );
  });

  it("queries with the correct select shape (user fields only)", async () => {
    const token = "shape-token";
    mockDb.session.findUnique.mockResolvedValueOnce(makeValidSessionRow(token));

    await validateSession(
      makeMockReq({ headers: { cookie: `next-auth.session-token=${token}` } }),
      makeMockRes().res,
      makeMockNext(),
    );

    expect(mockDb.session.findUnique).toHaveBeenCalledWith({
      where: { sessionToken: token },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  });

  it("calls next(401) when session is not found in DB", async () => {
    mockDb.session.findUnique.mockResolvedValueOnce(null);
    const next = makeMockNext();

    await validateSession(
      makeMockReq({ headers: { cookie: "next-auth.session-token=ghost" } }),
      makeMockRes().res,
      next,
    );

    expect(getNextError(next).statusCode).toBe(401);
    expect(getNextError(next).code).toBe("SESSION_EXPIRED");
  });

  it("calls next(401) when session is expired", async () => {
    mockDb.session.findUnique.mockResolvedValueOnce({
      ...makeValidSessionRow("expired-token"),
      expires: new Date(Date.now() - 1_000), // 1 second in the past
    });
    const next = makeMockNext();

    await validateSession(
      makeMockReq({ headers: { cookie: "next-auth.session-token=expired-token" } }),
      makeMockRes().res,
      next,
    );

    expect(getNextError(next).statusCode).toBe(401);
  });

  it("passes the raw DB error to next() on unexpected Prisma failure", async () => {
    const dbError = new Error("Connection refused");
    mockDb.session.findUnique.mockRejectedValueOnce(dbError);
    const next = makeMockNext();

    await validateSession(
      makeMockReq({ headers: { cookie: "next-auth.session-token=any-token" } }),
      makeMockRes().res,
      next,
    );

    // The catch block passes the raw DB error to next()
    expect(vi.mocked(next).mock.calls[0]?.[0]).toBe(dbError);
  });
});
