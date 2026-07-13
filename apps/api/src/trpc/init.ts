import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";

import { prisma, type PrismaClient } from "@taskflow/database";
import { type Role } from "@taskflow/shared";
import { isProduction } from "../config/env";
import { type Logger, logger } from "../config/logger";
import { getSessionUser } from "../utils/auth";

// Context

/**
 * Explicit interface for tRPC context.
 *
 * Using an interface (not inferred from the factory return) prevents
 * Prisma's internal `DefaultArgs` type from leaking into declaration files,
 * which would cause "inferred type cannot be named" TS errors.
 */

export interface SessionUser {
  id: string;
  email: string;
}
export interface TRPCContext {
  db: PrismaClient;
  logger: Logger;
  user: SessionUser | null;
}

export interface TRPCAuthedContext extends Omit<TRPCContext, "user"> {
  user: SessionUser;
}

/**
 * Extended context produced by roleGuard — adds the resolved membership role
 * so downstream procedures can read it without a second DB query.
 */
export type TRPCContextWithRole = TRPCAuthedContext & { membershipRole: Role };

// Context factory

/**
 * Called once per request by the Express adapter.
 *
 * tRPC v11 canonical pattern:
 * - Do NOT pass req/res directly into context.
 * - Extract only what procedures need: user identity, db, logger.
 *
 * `req.user` is attached by `validateSession` middleware for protected routes.
 * Public routes leave it undefined, which is coerced to null here.
 */
export async function createTRPCContext({
  req,
}: CreateExpressContextOptions): Promise<TRPCContext> {
  const user = await getSessionUser(req.headers.cookie ?? null);
  return { db: prisma, logger, user };
}

// tRPC instance

// Do NOT export the full `t` object — export named helpers individually.
// This prevents misuse and keeps the public API explicit
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Strip internal error details in production to prevent info leakage
        cause: isProduction() ? undefined : (error.cause as string | undefined),
      },
    };
  },
});

// Exported helpers

/** Factory for composing sub-routers — one per resource module. */
export const createTRPCRouter = t.router;

/** Base procedure — no auth, no guards. Starting point for all procedures. */
export const baseProcedure = t.procedure;

/** Used by apps/web RSC helpers to call procedures server-side. */
export const createCallerFactory = t.createCallerFactory;

/** Middleware builder — used internally by procedures.ts only. */
export const middleware = t.middleware;

// Re-export so modules don't need a direct @trpc/server import for errors
export { TRPCError };
