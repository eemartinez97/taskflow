import type { NextFunction, Request, Response } from "express";
import { createError } from "./error-handler";
import { type SessionUser } from "../trpc/init";
import { getSessionUser } from "../utils/auth";

/**
 * Reads the NextAuth v4 session token from the request cookie,
 * verifies it statelessly via @auth/core, and attaches the user to req.
 *
 * Used by the tRPC context factory to establish the caller's identity.
 */
export async function validateSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getSessionUser(req.headers.cookie);

    if (!user) {
      next(createError("Authenticated required", 401, "UNAUTHORIZED"));
      return;
    }

    // Attach user to request for downstream middleware and tRPC context
    req.user = { id: user.id, email: user.email };
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
