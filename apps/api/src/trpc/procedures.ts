import {
  baseProcedure,
  middleware,
  type TRPCContext,
  type TRPCContextWithRole,
  TRPCError,
} from "./init";
import { createTRPCRouter } from "./init";
import { type MiddlewareBuilder } from "@trpc/server/unstable-core-do-not-import";

import { type Role } from "@taskflow/database";
import { roleSchema } from "@taskflow/shared";
import {
  assertBoardInOrg,
  assertColumnInOrg,
  assertLabelInOrg,
  assertProjectInOrg,
  assertTaskInOrg,
} from "../modules/shared/tenancy";

/**
 * Returns null when rawInput is not an object or lacks a string `orgId`
 *
 *
 * Centralized here so both roleGuard and future middleware don't duplicate
 * the same rawInput narrowing pattern
 */
function extractOrgId(rawInput: unknown): string | null {
  if (rawInput === null || typeof rawInput !== "object") return null;

  const input = rawInput as Record<string, unknown>;
  const orgId = input.orgId;

  return typeof orgId === "string" && orgId.length > 0 ? orgId : null;
}

/**
 * Maps an input key to the tenancy assertion that must hold for it.
 * Adding a new scoped resource = one line here, zero changes elsewhere.
 */
const SCOPE_ASSERTIONS = {
  projectId: assertProjectInOrg,
  boardId: assertBoardInOrg,
  columnId: assertColumnInOrg,
  taskId: assertTaskInOrg,
  labelId: assertLabelInOrg,
} as const;

/**
 * Verifies every resource id present in the input actually lives inside
 * `orgId`. Without this, membership of ANY org is enough to mutate ANY
 * resource by id (IDOR across tenants).
 */
async function assertInputScopedToOrg(
  db: TRPCContext["db"],
  rawInput: unknown,
  orgId: string,
): Promise<void> {
  /* v8 ignore next */
  if (rawInput === null || typeof rawInput !== "object") return;

  const input = rawInput as Record<string, unknown>;

  for (const [key, assertFn] of Object.entries(SCOPE_ASSERTIONS)) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) {
      await assertFn(db, value, orgId);
    }
  }
}

// isAuthed middleware

/**
 * Middleware that asserts the caller has an active NextAuth v4 session
 * Narrows `ctx.user` from `{ id, email } | null` to `{ id, email }` (non-null)
 * so downstream procedures never need to null-check the user
 */
const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // narrowed: no longer `| null`
    },
  });
});

// Procedure builders

/**
 * Public procedure - no authentication required.
 * Use for: health probes, public metadata endpoints.
 */
export const publicProcedure = baseProcedure;

/**
 * Protected procedure -  requires an active NextAuth v4 session.
 * `ctx.user` is narrowed to non-null for all procedures that extend this.
 */
export const protectedProcedure = baseProcedure.use(isAuthed);

// RBAC role guard

/**
 * Composable role guard middleware factory.
 *
 * Usage (Open/Closed principle - extend by composing, not by editing):
 *
 *   const adminProcedure  = protectedProcedure.use(roleGuard(["OWNER", "ADMIN"]));
 *   const memberProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER"]));
 *
 * Design notes:
 * - Must be composed AFTER `protectedProcedure` so `ctx.user` is already non-null.
 * - Reads `orgId` from `rawInput` (tRPC v11 exposes it as a direct property).
 * - Uses `roleSchema.parse()` to coerce the Prisma `Role` enum value to the
 *   Zod-inferred `Role` type from `@taskflow/shared`, ensuring strict type
 *   compatibility when calling `allowedRoles.includes()`.
 * - Attaches `membershipRole` to ctx so downstream procedures can read the
 *   resolved role without issuing a second DB query.
 *
 * @param allowedRoles - Readonly array of roles permitted to execute the procedure.
 */
export function roleGuard(
  allowedRoles: readonly Role[],
): MiddlewareBuilder<TRPCContext, object, TRPCContextWithRole, unknown> {
  return middleware(async ({ ctx, next, getRawInput }) => {
    // Belt-and-suspenders: guard against accidental use without protectedProcedure
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
    }

    // tRPC v11: rawInput is a function, not a direct property
    const rawInput = await getRawInput();
    const orgId = extractOrgId(rawInput);

    if (!orgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "orgId is required for this operation",
      });
    }

    const membership = await ctx.db.membership.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: ctx.user.id,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not a member of this organization.",
      });
    }

    // safeParse instead of parse: if the DB returns an unknown role value
    // (e.g. data migration left a stale value), we surface a controlled
    // INTERNAL_SERVER_ERROR instead of leaking a raw ZodError to the client.
    const parsedRole = roleSchema.safeParse(membership.role);

    if (!parsedRole.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Membership role stored in database is invalid.`,
      });
    }

    const membershipRole = parsedRole.data;

    if (!allowedRoles.includes(membershipRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
      });
    }

    // Role is OK for this org - now make sure the ids in the payload belong to it
    await assertInputScopedToOrg(ctx.db, rawInput, orgId);

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        membershipRole,
      },
    });
  });
}

// Re-export router factory so resource modules only need one import
export { createTRPCRouter };
