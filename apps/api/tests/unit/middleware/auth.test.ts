import { vi, describe, it, expect, beforeEach } from "vitest";

// vi.hoisted() runs BEFORE vi.mock() hoisting — gives us a stable reference
// to the mock fn that can be used both inside the factory and in test assertions
// without ever accessing prisma.session.findUnique as an unbound method.
const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

// Mock @taskflow/database BEFORE importing the module under test
vi.mock("@taskflow/database", () => ({
  prisma: {
    session: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("../../../src/config/env.js", async () => {
  const { envMockFactory } = await import("../../mocks/env.js");
  return envMockFactory();
});

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
import { makeMockNext, makeMockReq, makeMockRes } from "../../helpers.js";
import { validateSession } from "../../../src/middleware/auth.js";

/** Minimal user shape returned by the session include */
const mockUser: Pick<User, "id" | "email"> = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "alice@example.com",
};

/** Session that expires far in the future */
function makeValidSession(token: string): Session & { user: Pick<User, "id" | "email"> } {
  return {
    id: "session-id-1",
    sessionToken: token,
    userId: mockUser.id,
    expires: new Date(Date.now() + 1000 * 60 * 60), // +1 hour
    user: mockUser,
  };
}

/**
 * Helper: extracts the first argument passed to next() as a typed AppError.
 * Casts through `unknown` first because mock.calls[0]?.[0] is typed as
 * `string | undefined` due to NextFunction's signature — a safe cast here
 * since we control exactly what the middleware passes to next().
 */
function getNextError(
  next: ReturnType<typeof makeMockNext>,
): Error & { statusCode: number; code?: string } {
  return vi.mocked(next).mock.calls[0]?.[0] as unknown as Error & {
    statusCode: number;
    code?: string;
  };
}

describe("validateSession middleware", () => {
  beforeEach(() => vi.resetAllMocks());

  it("calls next(error) with 401 when no session cookie is present", async () => {
    const req = makeMockReq({ cookies: {} });
    const { res } = makeMockRes();
    const next = makeMockNext();

    await validateSession(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(getNextError(next).statusCode).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("reads the http next-auth.session-token cookie", async () => {
    const token = "valid-session-token-http";
    mockFindUnique.mockResolvedValueOnce(makeValidSession(token));

    const req = makeMockReq({ cookies: { "next-auth.session-token": token } });
    const { res } = makeMockRes();
    const next = makeMockNext();

    await validateSession(req, res, next);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { sessionToken: token },
      include: { user: true },
    });
    expect(next).toHaveBeenCalledWith(); // called with no args = success
  });

  it("reads the __Secure- cookie when the plain one is absent", async () => {
    const token = "valid-session-token-secure";
    mockFindUnique.mockResolvedValueOnce(makeValidSession(token));

    const req = makeMockReq({
      cookies: {
        "__Secure-next-auth.session-token": token,
      },
    });
    const { res } = makeMockRes();
    const next = makeMockNext();

    await validateSession(req, res, next);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { sessionToken: token },
      include: { user: true },
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("attaches user to req on valid session", async () => {
    const token = "attach-user-token";
    mockFindUnique.mockResolvedValueOnce(makeValidSession(token));

    const req = makeMockReq({ cookies: { "next-auth.session-token": token } });
    const { res } = makeMockRes();
    const next = makeMockNext();

    await validateSession(req, res, next);

    expect(req.user).toEqual({ id: mockUser.id, email: mockUser.email });
  });

  it("calls next(error) with 401 when session is not found in DB", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const req = makeMockReq({ cookies: { "next-auth.session-token": "ghost-token" } });
    const { res } = makeMockRes();
    const next = makeMockNext();

    await validateSession(req, res, next);

    expect(getNextError(next).statusCode).toBe(401);
  });

  it("calls next(error) with 401 when session is expired", async () => {
    const expiredSession = {
      ...makeValidSession("expired-token"),
      expires: new Date(Date.now() - 1000), // 1 second in the past
    };
    mockFindUnique.mockResolvedValueOnce(expiredSession);

    const req = makeMockReq({ cookies: { "next-auth.session-token": "expired-token" } });
    const { res } = makeMockRes();
    const next = makeMockNext();

    await validateSession(req, res, next);
    expect(getNextError(next).statusCode).toBe(401);
  });

  it("calls next(error) when prisma throws an unexpected error", async () => {
    const dbError = new Error("Connection refused");
    mockFindUnique.mockRejectedValueOnce(dbError);

    const req = makeMockReq({ cookies: { "next-auth.session-token": "any-token" } });
    const { res } = makeMockRes();
    const next = makeMockNext();

    await validateSession(req, res, next);

    // The catch block passes the raw DB error to next()
    expect(vi.mocked(next).mock.calls[0]?.[0]).toBe(dbError);
  });
});
