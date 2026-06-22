import type { NextFunction, Request, Response } from "express";
import { createError } from "./error-handler.js";
import { prisma } from "@taskflow/database";
import { type SessionUser } from "../trpc/init.js";

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
  const token =
    (req.cookies as Record<string, string | undefined>)["next-auth.session-token"] ??
    (req.cookies as Record<string, string | undefined>)["__Secure-next-auth.session-token"];

  if (!token) {
    next(createError("Authentication required", 401, "UNAUTHORIZED"));
    return;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    });

    if (!session || session.expires < new Date()) {
      next(createError("Session expired or invalid", 401, "SESSION_EXPIRED"));
      return;
    }

    // Attach user to request for downstream middleware and tRPC context
    req.user = { id: session.user.id, email: session.user.email };
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
