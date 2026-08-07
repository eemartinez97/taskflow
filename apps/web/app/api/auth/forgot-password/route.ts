import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@taskflow/database";
import { EmailDeliveryError, sendPasswordResetEmail, sendVerificationEmail } from "@taskflow/mail";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { emailSender } from "@/lib/mail/sender";
import { serverEnv } from "@/lib/env.server";
import { AUTH_TOKEN_TTL_HOURS, invalidateOtherAuthTokens, issueAuthToken } from "@/lib/auth/tokens";
import {
  checkAuthEmailRateLimit,
  checkAuthIpRateLimit,
  releaseAuthEmailRateLimit,
  releaseAuthIpRateLimit,
} from "@/lib/auth/rate-limit";
import { parseJsonBody } from "@/lib/http/parse-json-body";
import { getClientIp } from "@/lib/http/client-ip";
import { withMinimumLatency } from "@/lib/http/with-minimum-latency";

const GENERIC_SUCCESS_MESSAGE = "If an account exists for that email, we've sent instructions.";

// Real-account branches below do a DB write + an awaited outbound email
// call that the nonexistent-account branch never touches - without a floor,
// that latency gap makes account existence observable via response timing
// even though the response BODY is always identical (see this route's own
// "ALWAYS responds with the same generic message" claim below). Picked
// close to a realistic p95 for the slower (email-sending) branches.
const MIN_RESPONSE_MS = 400;

/**
 * POST /api/auth/forgot-password
 *
 * ALWAYS responds with the same generic 200 message, whether or not the
 * email belongs to an account - this is the standard defense against
 * account-enumeration via password reset endpoints. Only the actual mailbox
 * owner (if any) ever sees a different outcome, via the email itself.
 *
 * Two real account states are handled differently server-side, but never
 * exposed to the caller:
 * - Verified: sends a password-reset link.
 * - Unverified (registered but never clicked the confirmation link): sends a
 *   FRESH verification email instead - a reset link is pointless for an
 *   account that still can't sign in at all.
 *
 * Response shapes:
 *   200 { message }  - always, regardless of outcome
 *   400 { error }    - validation failure
 *   429 { error }    - too many requests for this email OR from this IP
 *
 * NOTE: unlike /api/auth/register, every non-429 response here - success
 * AND failure - is the SAME generic 200. Don't copy register's
 * 500-on-catch shape into this route, or this route's always-200 shape into
 * register's, without re-reading both docblocks: the two routes make
 * opposite tradeoffs between enumeration-resistance and registration UX.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await parseJsonBody(req, forgotPasswordSchema);
  if ("error" in result) return result.error;

  const normalizedEmail = result.data.email.toLowerCase();

  // Two independent axes - see rate-limit.ts's docblock: the per-email limit
  // bounds requests AGAINST one target address, the per-IP limit bounds
  // requests FROM one actor (who could otherwise cycle through many target
  // emails and never trip the per-email limit on its own). clientIp is null
  // when genuinely unavailable - checkAuthIpRateLimit is simply skipped for
  // that request rather than sharing one bucket across every such request.
  const clientIp = getClientIp(req);
  const [emailCheck, ipCheck] = await Promise.all([
    checkAuthEmailRateLimit(normalizedEmail),
    clientIp ? checkAuthIpRateLimit(clientIp) : null,
  ]);
  if (emailCheck.limited || ipCheck?.limited) {
    // Only ONE axis may actually be the reason for this 429 - the other
    // axis's check still consumed a slot of quota above (Promise.all ran
    // both unconditionally) even though it didn't trip. Release that unused
    // slot so a request rejected purely on IP grounds doesn't also burn the
    // target email's budget (and vice versa) - see rate-limit.ts's docblock
    // on why the two axes are independent.
    if (!emailCheck.limited) {
      await releaseAuthEmailRateLimit(normalizedEmail, emailCheck.windowToken);
    }
    if (clientIp && ipCheck && !ipCheck.limited) {
      await releaseAuthIpRateLimit(clientIp, ipCheck.windowToken);
    }
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    await withMinimumLatency(async () => {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, name: true, emailVerified: true },
      });

      if (user?.emailVerified) {
        const { rawToken } = await issueAuthToken(prisma, user.id, "PASSWORD_RESET");
        const resetUrl = `${serverEnv.NEXTAUTH_URL}/reset-password?token=${rawToken}`;
        await sendPasswordResetEmail(emailSender, {
          to: normalizedEmail,
          name: user.name ?? "there",
          resetUrl,
          expiresInHours: AUTH_TOKEN_TTL_HOURS,
        });
        // Only invalidate the previous link now that the new one is
        // confirmed delivered - see issueAuthToken's docblock.
        await invalidateOtherAuthTokens(prisma, user.id, "PASSWORD_RESET", rawToken);
      } else if (user) {
        // Unverified account - guide them back to confirm their email instead.
        const { rawToken } = await issueAuthToken(prisma, user.id, "EMAIL_VERIFICATION");
        const verifyUrl = `${serverEnv.NEXTAUTH_URL}/verify-email?token=${rawToken}`;
        await sendVerificationEmail(emailSender, {
          to: normalizedEmail,
          name: user.name ?? "there",
          verifyUrl,
          expiresInHours: AUTH_TOKEN_TTL_HOURS,
        });
        await invalidateOtherAuthTokens(prisma, user.id, "EMAIL_VERIFICATION", rawToken);
      }
      // user === null: do nothing - no email to send, no state to leak.
    }, MIN_RESPONSE_MS);

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE }, { status: 200 });
  } catch (error) {
    // Only refund quota for failures upstream of a send attempt (DB down,
    // etc.) - NOT for a send that was attempted and actually failed
    // (EmailDeliveryError). Refunding on every failure let an attacker
    // trigger Resend errors (e.g. by exhausting its own quota) to make this
    // rate limiter refund itself indefinitely - see EmailDeliveryError's
    // docblock in @taskflow/mail.
    if (!(error instanceof EmailDeliveryError)) {
      await releaseAuthEmailRateLimit(normalizedEmail, emailCheck.windowToken);
      if (clientIp && ipCheck) await releaseAuthIpRateLimit(clientIp, ipCheck.windowToken);
    }
    console.error("[POST /api/auth/forgot-password] failed:", error);
    // Response is deliberately still generic - even a DB/email failure must
    // not leak account existence via a different response shape.
    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE }, { status: 200 });
  }
}
