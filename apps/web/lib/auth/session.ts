import { getServerSession as nextAuthGetServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { authOptions } from "@/auth";

/**
 * Server-side session accessor - NextAuth v4 pattern.
 *
 * Wraps `getServerSession(authOptions)` from `next-auth/next` so:
 * - Every Server Component / Route Handler imports from ONE place.
 * - Tests mock this module instead of mocking next-auth/next directly.
 * - The `authOptions` import is colocated with its usage, not scattered.
 *
 * IMPORTANT: Do NOT use the v5-only `auth()` helper - it does not exist in v4.
 */
export async function getSession(): Promise<Session | null> {
  return nextAuthGetServerSession(authOptions);
}

/**
 * Retrieves the current session and throws a redirect to /login
 * when the user is not authenticated.
 *
 * Use in Server Components and Route Handlers that require auth.
 * For Client Components, use `useSession()` from next-auth/react.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
