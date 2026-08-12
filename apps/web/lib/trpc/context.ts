import { type PrismaClient, prisma } from "@taskflow/database";
import { type SessionUser } from "@taskflow/shared";

import { type Logger, logger } from "@/lib/utils/logger";
import { getSession } from "../auth/session";

/**
 * Web-side tRPC context.
 *
 * Structurally compatible with `TRPCContext` in apps/api - TypeScript's
 * structural typing ensures compatibility without a direct import that would
 * pull Express/Socket.IO into the Next.js bundle.
 */
export interface WebTRPCContext {
  db: PrismaClient;
  logger: Logger;
  user: SessionUser | null;
  /**
   * Always null here: RSCs run queries exclusively (see server.ts's
   * docblock), and no query procedure reads clientIp today - only the
   * public auth mutations do, which always go through the browser's direct
   * HTTP client instead. Present only so this type stays structurally
   * assignable to apps/api's TRPCContext.
   */
  clientIp: null;
  /**
   * Always null here - internalProcedure-gated mutations (e.g.
   * auth.verifyCredentials) go through their own dedicated server-side HTTP
   * client (lib/trpc/http-server.ts), never this RSC caller. Present only
   * so this type stays structurally assignable to apps/api's TRPCContext.
   */
  internalSecretHeader: null;
  /**
   * Always null here, for the same reason as `internalSecretHeader` above -
   * the login/register/reset mutations that read this always go through the
   * browser's direct HTTP client or http-server.ts, never this RSC caller.
   */
  e2eSecretHeader: null;
}

/**
 * Web-side tRPC context factory.
 *
 * Canonical tRPC v11 signature `{ headers: Headers }`.
 * Authentication: reads the NextAuth v4 session token from the cookie header.
 */
export async function createWebTRPCContext(_opts: { headers: Headers }): Promise<WebTRPCContext> {
  const session = await getSession();
  return {
    db: prisma,
    logger,
    user: session,
    clientIp: null,
    internalSecretHeader: null,
    e2eSecretHeader: null,
  };
}
