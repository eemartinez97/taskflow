import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";

import { prisma, type PrismaClient } from "@taskflow/database";
import { type Role } from "@taskflow/shared";
import { isProduction } from "../config/env";
import { type Logger, logger } from "../config/logger";
import { getSessionUser } from "../utils/auth";
import { E2E_SECRET_HEADER } from "../utils/e2e";

// Context

/**
 * Explicit interface for tRPC context.
 *
 * Using an interface (not inferred from the factory return) prevents
 * Prisma's internal `DefaultArgs` type from leaking into declaration files,
 * which would cause "inferred type cannot be named" TS errors.
 */

export interface CtxUser {
  id: string;
  email: string;
}

export interface TRPCContext {
  db: PrismaClient;
  logger: Logger;
  user: CtxUser | null;
  /**
   * The caller's IP, as resolved by Express's `trust proxy` setting
   * (src/app.ts) - the same "count from the right" hop-trust semantics as
   * apps/web's TRUSTED_PROXY_HOPS. Only auth's per-IP rate limiter reads
   * this today; null is defensive (req.ip can theoretically be undefined
   * for a malformed request Express never fully parsed), not an expected
   * runtime state.
   */
  clientIp: string | null;
  /**
   * Raw `x-internal-secret` header value, read here (not deep inside
   * `internalProcedure`) so the header name has exactly one place it's
   * spelled. Compared against `env.INTERNAL_API_SECRET` by
   * `internalProcedure` (procedures.ts) - never used for anything else.
   */
  internalSecretHeader: string | null;
  /**
   * Raw `x-e2e-secret` header value, read here for the same reason as
   * `internalSecretHeader` above. Threaded down to the auth rate limiters
   * (modules/auth/rate-limit.ts) so their E2E bypass only fires for the
   * specific request that proves it knows the per-run secret - matching the
   * /api/test/* route guard's isAuthorizedE2ERequest() pattern
   * (utils/e2e.ts) - instead of bypassing rate limiting for every request
   * server-wide whenever E2E_TEST_SECRET merely happens to be set in the
   * process env.
   */
  e2eSecretHeader: string | null;
}

export interface TRPCAuthedContext extends Omit<TRPCContext, "user"> {
  user: CtxUser;
}

/**
 * Extended context produced by roleGuard - adds the resolved membership role
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
  const rawInternalSecret = req.headers["x-internal-secret"];
  const internalSecretHeader = typeof rawInternalSecret === "string" ? rawInternalSecret : null;
  const rawE2ESecret = req.headers[E2E_SECRET_HEADER];
  const e2eSecretHeader = typeof rawE2ESecret === "string" ? rawE2ESecret : null;
  return {
    db: prisma,
    logger,
    user,
    clientIp: req.ip ?? null,
    internalSecretHeader,
    e2eSecretHeader,
  };
}

// tRPC instance

// Do NOT export the full `t` object - export named helpers individually.
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

/** Factory for composing sub-routers - one per resource module. */
export const createTRPCRouter = t.router;

/** Base procedure - no auth, no guards. Starting point for all procedures. */
export const baseProcedure = t.procedure;

/** Used by apps/web RSC helpers to call procedures server-side. */
export const createCallerFactory = t.createCallerFactory;

/** Middleware builder - used internally by procedures.ts only. */
export const middleware = t.middleware;

// Re-export so modules don't need a direct @trpc/server import for errors
export { TRPCError };
