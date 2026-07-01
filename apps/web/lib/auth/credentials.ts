import { type PrismaClient } from "@taskflow/database";
import { verifyPassword } from "./password.js";

/**
 * The shape returned by `authorize()` - a subset of the full User row.
 * NextAuth v4 passes this object to the JWT / session callbacks.
 * `password` is intentionally excluded: it must never reach the session.
 */
export interface AuthorizedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

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
): Promise<AuthorizedUser | null> {
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
    return { id: user.id, email: user.email, name: user.name, image: user.image };
  } catch {
    // Surface DB errors as null to prevent information leakage
    return null;
  }
}
