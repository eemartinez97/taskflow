import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@taskflow/database";
import { EmailDeliveryError, sendVerificationEmail } from "@taskflow/mail";
import { registerSchema } from "@/lib/auth/schemas";
import { hashPassword } from "@/lib/auth/password";
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

/**
 * Normalizes the email field in an unknown body object before schema validation.
 * Browser autofill sometimes pads emails with whitespace; trimming happens
 * here (before Zod) so `.email()` validation never sees the padding, and
 * lowercasing happens after Zod parses.
 */
function preprocessBody(body: unknown): unknown {
  if (body === null || typeof body !== "object") return body;
  const raw = body as Record<string, unknown>;
  const email = raw.email;
  if (typeof email !== "string") return body;
  return { ...raw, email: email.trim() };
}

/**
 * POST /api/auth/register
 *
 * Single-step registration: collects name, email, and password up front,
 * creates the account with a hashed password, and emails a confirmation
 * link. The account cannot sign in until that link is clicked - see
 * authorizeCredentials's `emailVerified` guard and /verify-email.
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
 * Response shapes:
 *   201 { message }  - verification email sent (fresh signup OR resend)
 *   400 { error }     - validation failure
 *   409 { error }     - a VERIFIED account already uses this email
 *   429 { error }     - too many requests for this email OR from this IP
 *   500 { error }     - unexpected server error
 *
 * NOTE: unlike /api/auth/forgot-password, this route's error responses are
 * NOT generic - a 409 here deliberately reveals that a verified account
 * already owns the email (registration UX outweighs enumeration risk at
 * this specific endpoint). Don't copy this route's error-handling shape
 * into forgot-password's, or vice versa, without re-reading both docblocks.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await parseJsonBody(req, registerSchema, preprocessBody);
  if ("error" in result) return result.error;

  const { name, email, password } = result.data;
  const normalizedEmail = email.toLowerCase();

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
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, emailVerified: true },
    });

    // A verified account already owns this email.
    if (existing?.emailVerified) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }

    // Brand-new signup, or an abandoned one (never verified) - reuse the row
    // so retrying never creates duplicate accounts. An existing unverified
    // row's name/password are left untouched (see the docblock above) - only
    // a genuinely new row gets the submitted password hashed and stored.
    const user =
      existing ??
      (await prisma.user.create({
        data: { name, email: normalizedEmail, password: await hashPassword(password) },
      }));

    const { rawToken } = await issueAuthToken(prisma, user.id, "EMAIL_VERIFICATION");
    const verifyUrl = `${serverEnv.NEXTAUTH_URL}/verify-email?token=${rawToken}`;

    await sendVerificationEmail(emailSender, {
      to: normalizedEmail,
      name: user.name ?? name,
      verifyUrl,
      expiresInHours: AUTH_TOKEN_TTL_HOURS,
    });

    // Only invalidate the previous link now that the new one is confirmed
    // delivered - see issueAuthToken's docblock.
    await invalidateOtherAuthTokens(prisma, user.id, "EMAIL_VERIFICATION", rawToken);

    return NextResponse.json(
      { message: "Check your email to confirm your account." },
      { status: 201 },
    );
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
    console.error("[POST /api/auth/register] failed:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
