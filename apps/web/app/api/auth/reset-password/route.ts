import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@taskflow/database";
import { resetPasswordSchema } from "@/lib/auth/schemas";
import { hashPassword } from "@/lib/auth/password";
import {
  consumeTokenAndResetPassword,
  findValidAuthToken,
  TokenAlreadyConsumedError,
} from "@/lib/auth/tokens";
import { parseJsonBody } from "@/lib/http/parse-json-body";

/**
 * POST /api/auth/reset-password
 *
 * Consumes the emailed PASSWORD_RESET token and sets the new password.
 * Re-validates the token server-side even though the page already checked
 * it on render - never trust client-supplied state for a security-sensitive
 * mutation.
 *
 * Response shapes:
 *   200 { message }  - password changed
 *   400 { error }    - validation failure
 *   410 { error }    - token invalid, expired, or already used
 *   500 { error }    - unexpected server error
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await parseJsonBody(req, resetPasswordSchema);
  if ("error" in result) return result.error;

  const { token, password } = result.data;

  try {
    const validToken = await findValidAuthToken(prisma, token, "PASSWORD_RESET");
    if (!validToken) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 410 },
      );
    }

    const hashed = await hashPassword(password);
    await consumeTokenAndResetPassword(prisma, validToken.id, validToken.userId, hashed);

    return NextResponse.json({ message: "Password updated." }, { status: 200 });
  } catch (error) {
    if (error instanceof TokenAlreadyConsumedError) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 410 },
      );
    }
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
