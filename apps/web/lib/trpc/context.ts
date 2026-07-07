import { type PrismaClient, prisma } from "@taskflow/database";
import { type SessionUser } from "@taskflow/shared";

import { getServerSessionFromHeaders } from "../auth/server-session";
import { type Logger, logger } from "../logger";

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
}

/**
 * Web-side tRPC context factory.
 *
 * Canonical tRPC v11 signature `{ headers: Headers }`.
 * Authentication: reads the NextAuth v4 session token from the cookie header.
 */
export async function createWebTRPCContext(opts: { headers: Headers }): Promise<WebTRPCContext> {
  const session = await getServerSessionFromHeaders(opts.headers);
  return { db: prisma, logger, user: session };
}
