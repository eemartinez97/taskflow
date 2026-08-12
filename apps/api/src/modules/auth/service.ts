import type { PrismaClient } from "@taskflow/database";
import type { SessionUser, UpdateUser } from "@taskflow/shared";
import {
  EmailDeliveryError,
  sendAccountActivatedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@taskflow/mail";

import {
  createUnverifiedUser,
  deleteUserSessions,
  findUserById,
  findUserByEmail,
  findUserForActivationNotice,
  findUserForCredentials,
  updateUser,
} from "./repo";
import { hashPassword, verifyPassword } from "./password";
import {
  AUTH_TOKEN_TTL_HOURS,
  TokenAlreadyConsumedError,
  consumeTokenAndResetPassword,
  findValidAuthToken,
  invalidateOtherAuthTokens,
  issueAuthToken,
  verifyEmailFromToken,
} from "./tokens";
import {
  checkLoginEmailRateLimit,
  checkLoginIpRateLimit,
  enforceAuthRateLimit,
  releaseAuthRateLimit,
} from "./rate-limit";
import { TRPCError } from "../../trpc/init";
import { env } from "../../config/env";
import { getEmailSender } from "../../mail/sender";
import { withMinimumLatency } from "../../utils/with-minimum-latency";
import { fireAndForget } from "../../utils/fire-and-forget";

export async function getMe(db: PrismaClient, userId: string): Promise<SessionUser> {
  const user = await findUserById(db, userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
  return user;
}

export async function signOutUser(db: PrismaClient, userId: string): Promise<{ success: true }> {
  await deleteUserSessions(db, userId);
  return { success: true };
}

export async function updateMyProfile(
  db: PrismaClient,
  userId: string,
  data: UpdateUser,
): Promise<SessionUser> {
  await getMe(db, userId); // NOT_FOUND if the account was deleted
  return updateUser(db, userId, data);
}

// -- Public (unauthenticated) auth procedures --

export interface RegisterUserInput {
  name: string;
  /** Already normalized (trim + lowercase) by the router's emailField() input schema. */
  email: string;
  password: string;
}

/**
 * Single-step registration: collects name, email, and password up front,
 * creates the account with a hashed password, and emails a confirmation
 * link. The account cannot sign in until that link is clicked - see
 * auth.verifyCredentials's `emailVerified` guard and auth.verifyEmail.
 *
 * Resubmitting with the SAME email while the account is still unverified is
 * treated as "resend the link" instead of a duplicate-account error - this is
 * how an abandoned signup self-heals without creating orphan rows or
 * permanently locking someone out of a typo'd first attempt. Crucially, this
 * resend does NOT overwrite the existing row's name/password with whatever
 * was just submitted: doing so would let anyone who merely knows a pending
 * email address hijack it by "re-registering" with their own password before
 * the real owner's mailbox confirms it - the fresh verification link that
 * gets sent still activates the ORIGINAL account with the ORIGINAL password.
 * An attacker's submitted credentials are simply never persisted.
 *
 * NOTE: unlike auth.requestPasswordReset, this procedure's errors are NOT
 * generic - a CONFLICT here deliberately reveals that a verified account
 * already owns the email (registration UX outweighs enumeration risk at this
 * specific endpoint). Don't copy this shape into requestPasswordReset's, or
 * vice versa, without re-reading both docblocks.
 */
export async function registerUser(
  db: PrismaClient,
  input: RegisterUserInput,
  clientIp: string | null,
  e2eSecretHeader: string | null,
): Promise<{ message: string }> {
  // Two independent axes - see rate-limit.ts's docblock: the per-email limit
  // bounds requests AGAINST one target address, the per-IP limit bounds
  // requests FROM one actor (who could otherwise cycle through many target
  // emails and never trip the per-email limit on its own). clientIp is null
  // when genuinely unavailable - the IP check is simply skipped for that
  // request rather than sharing one bucket across every such request.
  const rateLimitState = await enforceAuthRateLimit(db, input.email, clientIp, e2eSecretHeader);

  try {
    const existing = await findUserByEmail(db, input.email);

    // A verified account already owns this email.
    if (existing?.emailVerified) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account with that email already exists.",
      });
    }

    // Brand-new signup, or an abandoned one (never verified) - reuse the row
    // so retrying never creates duplicate accounts. An existing unverified
    // row's name/password are left untouched (see the docblock above) - only
    // a genuinely new row gets the submitted password hashed and stored.
    const user =
      existing ??
      (await createUnverifiedUser(db, {
        name: input.name,
        email: input.email,
        hashedPassword: await hashPassword(input.password),
      }));

    const { rawToken } = await issueAuthToken(db, user.id, "EMAIL_VERIFICATION");
    const verifyUrl = `${env.WEB_ORIGIN}/verify-email?token=${rawToken}`;

    await sendVerificationEmail(getEmailSender(), {
      to: input.email,
      name: user.name ?? input.name,
      verifyUrl,
      expiresInHours: AUTH_TOKEN_TTL_HOURS,
    });

    // Only invalidate the previous link now that the new one is confirmed
    // delivered - see issueAuthToken's docblock.
    await invalidateOtherAuthTokens(db, user.id, "EMAIL_VERIFICATION", rawToken);

    return { message: "Check your email to confirm your account." };
  } catch (error) {
    // CONFLICT above is a legitimate consumed attempt, not an infra
    // failure - never refund quota for it.
    if (error instanceof TRPCError) throw error;

    // Only refund quota for failures upstream of a send attempt (DB down,
    // etc.) - NOT for a send that was attempted and actually failed
    // (EmailDeliveryError). Refunding on every failure would let an attacker
    // trigger Resend errors (e.g. by exhausting its own quota) to make this
    // rate limiter refund itself indefinitely - see EmailDeliveryError's
    // docblock in @taskflow/mail.
    if (!(error instanceof EmailDeliveryError)) {
      await releaseAuthRateLimit(db, input.email, clientIp, rateLimitState);
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      cause: error,
    });
  }
}

/**
 * Sends the "your account is active" notification for a freshly-activated
 * account. Best-effort and fire-and-forget (see verifyEmail below) - a
 * delivery failure here must never turn the verification itself into an
 * error, it's only logged. Not called for a repeat visit to an
 * already-consumed link (see `freshlyActivated` in verifyEmailFromToken's
 * docblock), so this fires at most once per account.
 */
async function notifyAccountActivated(db: PrismaClient, userId: string): Promise<void> {
  const user = await findUserForActivationNotice(db, userId);
  if (!user) return;

  await sendAccountActivatedEmail(getEmailSender(), {
    to: user.email,
    name: user.name ?? user.email,
    loginUrl: `${env.WEB_ORIGIN}/login`,
  });
}

export interface VerifyEmailOutput {
  verified: boolean;
}

/**
 * Confirms an emailed verification link. See `verifyEmailFromToken`'s
 * docblock for the full consume-on-GET-is-safe rationale (still true here:
 * the caller is a public tRPC query, not literally a GET, but the same
 * prefetch/idempotency argument applies to any no-auth-required call).
 *
 * The activation-notice email is dispatched without awaiting it - unlike
 * apps/web's former `after()` scheduling (a Next.js-only primitive), a
 * detached promise with its own `.catch()` is the direct Express
 * equivalent: the response returns immediately, and a delivery failure is
 * still logged instead of becoming an unhandled rejection.
 */
export async function verifyEmail(db: PrismaClient, token: string): Promise<VerifyEmailOutput> {
  const result = await verifyEmailFromToken(db, token);
  if (!result.verified) return { verified: false };

  if (result.freshlyActivated) {
    fireAndForget(
      notifyAccountActivated(db, result.userId),
      "auth.verifyEmail: failed to send account-activated email",
    );
  }

  return { verified: true };
}

const GENERIC_RESET_MESSAGE = "If an account exists for that email, we've sent instructions.";

// Real-account branches below do a DB write + an awaited outbound email
// call that the nonexistent-account branch never touches - without a floor,
// that latency gap makes account existence observable via response timing
// even though the response BODY is always identical (see requestPasswordReset's
// own "ALWAYS responds with the same generic message" claim below). Picked
// close to a realistic p95 for the slower (email-sending) branches.
const MIN_RESPONSE_MS = 400;

export interface RequestPasswordResetInput {
  /** Already normalized (trim + lowercase) by the router's emailField() input schema. */
  email: string;
}

/**
 * ALWAYS returns the same generic message, whether or not the email belongs
 * to an account - this is the standard defense against account-enumeration
 * via password reset endpoints. Only the actual mailbox owner (if any) ever
 * sees a different outcome, via the email itself.
 *
 * Two real account states are handled differently server-side, but never
 * exposed to the caller:
 * - Verified: sends a password-reset link.
 * - Unverified (registered but never clicked the confirmation link): sends a
 *   FRESH verification email instead - a reset link is pointless for an
 *   account that still can't sign in at all.
 *
 * NOTE: unlike auth.register, every outcome here - success AND failure - is
 * the SAME generic message. Don't copy register's throw-on-failure shape
 * into this procedure, or this procedure's always-generic shape into
 * register's, without re-reading both docblocks: the two make opposite
 * tradeoffs between enumeration-resistance and registration UX.
 */
export async function requestPasswordReset(
  db: PrismaClient,
  input: RequestPasswordResetInput,
  clientIp: string | null,
  e2eSecretHeader: string | null,
): Promise<{ message: string }> {
  const rateLimitState = await enforceAuthRateLimit(db, input.email, clientIp, e2eSecretHeader);

  try {
    await withMinimumLatency(async () => {
      const user = await findUserByEmail(db, input.email);

      if (user?.emailVerified) {
        const { rawToken } = await issueAuthToken(db, user.id, "PASSWORD_RESET");
        const resetUrl = `${env.WEB_ORIGIN}/reset-password?token=${rawToken}`;
        await sendPasswordResetEmail(getEmailSender(), {
          to: input.email,
          name: user.name ?? "there",
          resetUrl,
          expiresInHours: AUTH_TOKEN_TTL_HOURS,
        });
        // Only invalidate the previous link now that the new one is
        // confirmed delivered - see issueAuthToken's docblock.
        await invalidateOtherAuthTokens(db, user.id, "PASSWORD_RESET", rawToken);
      } else if (user) {
        // Unverified account - guide them back to confirm their email instead.
        const { rawToken } = await issueAuthToken(db, user.id, "EMAIL_VERIFICATION");
        const verifyUrl = `${env.WEB_ORIGIN}/verify-email?token=${rawToken}`;
        await sendVerificationEmail(getEmailSender(), {
          to: input.email,
          name: user.name ?? "there",
          verifyUrl,
          expiresInHours: AUTH_TOKEN_TTL_HOURS,
        });
        await invalidateOtherAuthTokens(db, user.id, "EMAIL_VERIFICATION", rawToken);
      }
      // user === null: do nothing - no email to send, no state to leak.
    }, MIN_RESPONSE_MS);

    return { message: GENERIC_RESET_MESSAGE };
  } catch (error) {
    // Only refund quota for failures upstream of a send attempt (DB down,
    // etc.) - NOT for a send that was attempted and actually failed
    // (EmailDeliveryError). See registerUser's identical comment.
    if (!(error instanceof EmailDeliveryError)) {
      await releaseAuthRateLimit(db, input.email, clientIp, rateLimitState);
    }
    // Response is deliberately still generic - even a DB/email failure must
    // not leak account existence via a different response shape.
    return { message: GENERIC_RESET_MESSAGE };
  }
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

/**
 * Consumes the emailed PASSWORD_RESET token and sets the new password.
 * Re-validates the token server-side even though the reset page already
 * checked it on render - never trust client-supplied state for a
 * security-sensitive mutation.
 */
export async function resetPassword(
  db: PrismaClient,
  input: ResetPasswordInput,
): Promise<{ message: string }> {
  const validToken = await findValidAuthToken(db, input.token, "PASSWORD_RESET");
  if (!validToken) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This reset link is invalid or has expired.",
    });
  }

  try {
    const hashed = await hashPassword(input.password);
    await consumeTokenAndResetPassword(db, validToken.id, validToken.userId, hashed);
    return { message: "Password updated." };
  } catch (error) {
    if (error instanceof TokenAlreadyConsumedError) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "This reset link is invalid or has expired.",
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      cause: error,
    });
  }
}

// Fixed bcrypt hash of an unguessable, never-used password - compared
// against on every "no such user" / "no password set" path below so an
// unknown email costs the same wall-clock time as a real bcrypt compare.
// Without this, skipping straight to `return null` for a nonexistent email
// is a measurable enumeration oracle (bcrypt's ~250ms dominates response
// time, so "had to hash" vs. "didn't" is trivially distinguishable).
const DUMMY_PASSWORD_HASH = "$2b$12$V7UPTxijrn2sJChKxoA/Z.BjZmOAl7fxR22oXuk3/zbgJHdzwIUmm";

export interface VerifyCredentialsInput {
  /** Already normalized (trim + lowercase) by the router's emailField() input schema. */
  email: string;
  password: string;
  /**
   * The BROWSER's IP, forwarded explicitly by apps/web's server-to-server
   * caller - `ctx.clientIp` here would only ever be apps/web's own server
   * IP (the immediate hop), not the real end user's. See
   * apps/web/lib/http/client-ip.ts's docblock for the other half of this.
   */
  clientIp: string | null;
}

/**
 * Core credentials authorization logic behind `internalProcedure` - never
 * reachable from a browser directly (see procedures.ts's requireInternalSecret).
 *
 * Returns `null` in EVERY failure case - unknown email, unverified account,
 * no password set, wrong password, rate limited, or a DB error - so no
 * caller can distinguish "wrong password" from "no such account" via the
 * return shape. Preserved verbatim from apps/web's former
 * `authorizeCredentials`, now additionally rate limited (see
 * checkLoginEmailRateLimit/checkLoginIpRateLimit's docblock for why login
 * specifically had none before this move) and hardened against the
 * enumeration-via-timing gap described on DUMMY_PASSWORD_HASH above.
 */
export async function verifyCredentials(
  db: PrismaClient,
  input: VerifyCredentialsInput,
  e2eSecretHeader: string | null,
): Promise<SessionUser | null> {
  try {
    const [emailCheck, ipCheck] = await Promise.all([
      checkLoginEmailRateLimit(db, input.email, e2eSecretHeader),
      input.clientIp ? checkLoginIpRateLimit(db, input.clientIp, e2eSecretHeader) : null,
    ]);
    if (emailCheck.limited || ipCheck?.limited) return null;

    const user = await findUserForCredentials(db, input.email);

    // Both guards matter: `emailVerified` null means the account was
    // registered but never confirmed via the emailed link. `password` null
    // is defense-in-depth in case a User row is ever created through
    // another path (e.g. a future OAuth provider) without one.
    if (!user?.password || !user.emailVerified) {
      await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
      return null;
    }

    const valid = await verifyPassword(input.password, user.password);
    if (!valid) return null;

    return { id: user.id, email: user.email, name: user.name, image: user.image };
  } catch {
    // Surface DB errors as null to prevent information leakage.
    return null;
  }
}

/**
 * Read-only PASSWORD_RESET token check for the /reset-password page's RSC
 * gate (rendered before the user has typed anything) - never consumes the
 * token. `resetPassword` re-validates and consumes it for real at submit
 * time; this is only "is it even worth showing the form" pre-flight, same
 * spirit as `findValidAuthToken`'s own docblock on why a GET/render must
 * stay side-effect free.
 */
export async function checkResetToken(
  db: PrismaClient,
  token: string,
): Promise<{ valid: boolean }> {
  const validToken = await findValidAuthToken(db, token, "PASSWORD_RESET");
  return { valid: validToken !== null };
}
