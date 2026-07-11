import { type PrismaClient } from "@taskflow/database";
import type { SessionUser } from "@taskflow/shared";
import { verifyPassword } from "./password";

/**
 * Core credentials authorization logic - fully injectable.
 *
 * WHY a standalone function (not inlined in authOptions):
 * - Testable without mocking the entire NextAuth configuration.
 * - `db` is injected so unit tests pass a mock PrismaClient.
 * - Single responsibility: validate email+password, return user or null.
 *
 * Returns `null` in ALL error cases (wrong email, wrong password, DB error)
 * to prevent user-enumeration attacks via timing or error message differences.
 */
export async function authorizeCredentials(
  db: PrismaClient,
  credentials: Partial<Record<string, string>>,
): Promise<SessionUser | null> {
  // 1. Email is normalized to lowercase. Password is left EXACTLY as typed.
  const email = credentials.email?.trim().toLowerCase();
  const plainPassword = credentials.password;

  if (!email || !plainPassword) return null;

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        password: true,
      },
    });

    if (!user?.password) return null;

    const valid = await verifyPassword(plainPassword, user.password);
    if (!valid) return null;

    // Strip the password hash before returning - it must never reach callbacks
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch {
    // Surface DB errors as null to prevent information leakage
    return null;
  }
}
