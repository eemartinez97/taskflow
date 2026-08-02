/**
 * NextAuth v4 type augmentations.
 *
 * Three interfaces are extended here:
 *
 * 1. Session.user - adds `id: string` so Server Components and Client
 *    Components can read session.user.id without casting.
 *
 * 2. JWT - adds `id?: string` (our custom claim set in the jwt callback).
 *    Marking it optional is intentional: the claim is absent until the
 *    first sign-in populates it, and TypeScript must allow the guard
 *    `if (token.id)` in the session callback without a lint warning.
 *
 * 3. User - narrows `id` from `string | undefined` (DefaultUser) to
 *    `string` so `user.id` in the jwt callback and authorize() are
 *    assignable without non-null assertions.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    /** Custom claim: the authenticated user's database id. */
    id?: string;
  }
}
