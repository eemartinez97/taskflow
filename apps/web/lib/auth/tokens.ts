import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenType, PrismaClient } from "@taskflow/database";

/** Verification and reset links expire after this many hours. */
export const AUTH_TOKEN_TTL_HOURS = 1;

const RAW_TOKEN_BYTES = 32;

/** SHA-256 hex digest - the raw token is never persisted, only this hash. */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface IssuedAuthToken {
  rawToken: string;
  expiresAt: Date;
}

/**
 * Issues a new single-use token of `type` for `userId`.
 *
 * Does NOT touch any previously issued token of the same type - callers
 * must send the email built from the returned raw token first, and only
 * call `invalidateOtherAuthTokens` once that send has actually succeeded.
 * Deleting the old (still-working) token up front used to mean a Resend
 * outage or network flake left the user with neither link: the old one
 * destroyed, the new one never delivered. Issuing before invalidating
 * briefly allows two valid links to coexist, which is harmless - it just
 * means the safe failure mode by default.
 *
 * Returns the RAW token - the only moment it ever exists in plaintext.
 * Callers must embed it in the email link and never log or persist it.
 */
export async function issueAuthToken(
  db: PrismaClient,
  userId: string,
  type: AuthTokenType,
): Promise<IssuedAuthToken> {
  const rawToken = randomBytes(RAW_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await db.authToken.create({ data: { userId, type, tokenHash, expiresAt } });
  return { rawToken, expiresAt };
}

/**
 * Deletes every OTHER still-active token of `type` for `userId`, keeping
 * only the one identified by `currentRawToken`. Call this AFTER the email
 * carrying `currentRawToken` has been sent successfully, so a user can't
 * end up with more than one outstanding valid link once the new one is
 * confirmed delivered. Best-effort: if this fails, the old token just stays
 * valid until it naturally expires - not a lockout, so callers don't need
 * to roll back the new token on failure here.
 */
export async function invalidateOtherAuthTokens(
  db: PrismaClient,
  userId: string,
  type: AuthTokenType,
  currentRawToken: string,
): Promise<void> {
  await db.authToken.deleteMany({
    where: { userId, type, consumedAt: null, tokenHash: { not: hashToken(currentRawToken) } },
  });
}

export interface ValidAuthToken {
  id: string;
  userId: string;
}

/**
 * Thrown by `consumeEmailVerification` / `consumeTokenAndResetPassword` when
 * the token was already consumed by a concurrent request between the
 * caller's `findValidAuthToken` check and the consume call. Callers should
 * treat this the same as "invalid or expired" (410).
 */
export class TokenAlreadyConsumedError extends Error {
  constructor() {
    super("Token was already consumed");
    this.name = "TokenAlreadyConsumedError";
  }
}

/**
 * Read-only validity check - does NOT consume the token.
 *
 * Safe to call from a GET request: email clients (Outlook, Gmail image
 * proxies, some antivirus scanners) prefetch links, and a mutating GET
 * would burn the token before the real user ever clicks it.
 */
export async function findValidAuthToken(
  db: PrismaClient,
  rawToken: string,
  type: AuthTokenType,
): Promise<ValidAuthToken | null> {
  const record = await db.authToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (record?.type !== type) return null;
  if (record.consumedAt || record.expiresAt.getTime() < Date.now()) return null;
  return { id: record.id, userId: record.userId };
}

/**
 * Confirms a registration email link: marks the account verified and
 * consumes the token - atomically, so a half-verified user or a burned
 * token that never took effect can't happen.
 *
 * The consume step is a conditional `updateMany` guarded on
 * `consumedAt: null`, not a plain `update` - two concurrent requests racing
 * the same raw token (both having passed `findValidAuthToken` before either
 * writes) must not both succeed. Only the first `updateMany` matches a row;
 * the loser throws `TokenAlreadyConsumedError` instead of also verifying the
 * account.
 */
export async function consumeEmailVerification(
  db: PrismaClient,
  tokenId: string,
  userId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const { count } = await tx.authToken.updateMany({
      where: { id: tokenId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count === 0) throw new TokenAlreadyConsumedError();
    await tx.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  });
}

export type VerifyEmailResult =
  | { verified: true; freshlyActivated: boolean; userId: string }
  | { verified: false };

/**
 * Confirms an emailed verification link and reports whether the account is
 * verified - called directly from the /verify-email page's GET render, so
 * opening the link is enough; there is no separate confirm click.
 *
 * Unlike `findValidAuthToken` (kept read-only for /reset-password - see its
 * docblock), this deliberately mutates on GET. That's normally unsafe
 * because mail clients (Outlook Safe Links, Gmail image proxies, antivirus
 * scanners) prefetch links and would burn the token before the real user
 * sees the page. It's safe here because a prefetch and the real click race
 * for the SAME token hash: whichever request wins consumes it and verifies
 * the account, and the loser - now looking at an already-consumed token for
 * an already-verified user - is reported verified too, not an error. Only a
 * token that was never validly issued, or that expired unconsumed, reports
 * `verified: false`.
 *
 * `freshlyActivated` is true only for the single request that actually
 * flipped `emailVerified` just now (this call's `consumeEmailVerification`
 * succeeded) - false for a repeat visit to an already-consumed link, and
 * false for the loser of the prefetch/real-click race above. The caller
 * uses this to send the "your account is active" notification email exactly
 * once per account, not on every re-open of the same link.
 */
export async function verifyEmailFromToken(
  db: PrismaClient,
  rawToken: string,
): Promise<VerifyEmailResult> {
  const record = await db.authToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (record?.type !== "EMAIL_VERIFICATION") return { verified: false };

  if (record.consumedAt) {
    const user = await db.user.findUnique({
      where: { id: record.userId },
      select: { emailVerified: true },
    });
    return user?.emailVerified
      ? { verified: true, freshlyActivated: false, userId: record.userId }
      : { verified: false };
  }

  if (record.expiresAt.getTime() < Date.now()) return { verified: false };

  try {
    await consumeEmailVerification(db, record.id, record.userId);
    return { verified: true, freshlyActivated: true, userId: record.userId };
  } catch (error) {
    if (error instanceof TokenAlreadyConsumedError) {
      return { verified: true, freshlyActivated: false, userId: record.userId };
    }
    throw error;
  }
}

/**
 * Completes a password reset: sets the new password and consumes the token
 * atomically. See `consumeEmailVerification` for why the consume step is a
 * conditional `updateMany` rather than a plain `update`.
 *
 * Also stamps `passwordChangedAt` - apps/api's getSessionUser checks this
 * against a session's JWT `iat` claim to reject any session issued before
 * this reset, so a stolen session cookie doesn't survive its own victim's
 * reset indefinitely. See that function's docblock for the full rationale.
 */
export async function consumeTokenAndResetPassword(
  db: PrismaClient,
  tokenId: string,
  userId: string,
  hashedPassword: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const { count } = await tx.authToken.updateMany({
      where: { id: tokenId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count === 0) throw new TokenAlreadyConsumedError();
    await tx.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });
  });
}
