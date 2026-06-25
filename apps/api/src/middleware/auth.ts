import type { NextFunction, Request, Response } from "express";
import { createError } from "./error-handler.js";
import { prisma } from "@taskflow/database";
import { type SessionUser } from "../trpc/init.js";
import { parseCookieToken } from "../utils/cookies.js";
import { validateSessionToken } from "../utils/session.js";

/**
 * Reads the NextAuth v4 session token from the request cookie,
 * validates it against the Session table, and attaches the user to req.
 *
 * Used by the tRPC context factory to establish the caller's identity.
 */
export async function validateSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // NextAuth v4 uses different cookie names for http vs https
  const token = parseCookieToken(req.headers.cookie ?? "");

  if (!token) {
    next(createError("Authentication required", 401, "UNAUTHORIZED"));
    return;
  }

  try {
    const session = await validateSessionToken(prisma, token);

    if (!session) {
      next(createError("Session expired or invalid", 401, "SESSION_EXPIRED"));
      return;
    }

    // Attach user to request for downstream middleware and tRPC context
    req.user = { id: session.userId, email: session.email };
    next();
  } catch (err) {
    next(err);
  }
}

// Augment Express Request type - scoped to this module to avoid global pollution
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
