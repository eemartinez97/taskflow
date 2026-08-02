import type { AnyTRPCRouter } from "@trpc/server";
import { expect } from "vitest";

import { createCallerFactory } from "../../src/trpc/init";
import { makeCtx, VALID_USER } from "../helpers";
import { mockDb } from "../mocks/database-mock";

export type CtxUser = { id: string; email: string } | null;

type CallerOf<TRouter extends AnyTRPCRouter> = ReturnType<TRouter["createCaller"]>;

/** Builds a server-side caller for a router with a given (or anonymous) user. */
export function callerFor<TRouter extends AnyTRPCRouter>(
  router: TRouter,
  user: CtxUser = VALID_USER,
): CallerOf<TRouter> {
  return createCallerFactory(router)(makeCtx(user)) as CallerOf<TRouter>;
}

/** Makes roleGuard resolve the caller's membership to `role` */
export function grantRole(role: string): void {
  mockDb.membership.findUnique.mockResolvedValue({ role });
}

/** Makes roleGuard find no membership -> FORBIDDEN. */
export function denyMembership(): void {
  mockDb.membership.findUnique.mockResolvedValue(null);
}

/** Asserts a tRPC call rejects with a specific TRPCError code. */
export async function expectTRPCError(promise: unknown, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}
