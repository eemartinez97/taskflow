import type { NextAuthOptions, Session, User } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@taskflow/database";
import { authorizeCredentials } from "./lib/auth/credentials";
import { serverEnv } from "./lib/env";

/**
 * NextAuth v4 - `authOptions` configuration.
 *
 * Key decisions
 * - Stable v4 line (`next-auth@4.24.14`) - NOT Auth.js v5 beta.
 * - `@auth/prisma-adapter` v2.x - compatible with v4.24+.
 * - Session strategy: `database` - RBAC durability.
 * - `NEXTAUTH_SECRET` env var (NOT `AUTH_SECRET`).
 * - `getServerSession(authOptions)` for server-side access.
 * - Do NOT call the v5-only `auth()` helper.
 *
 * The `authorizeCredentials` function live in lib/auth/credentials.ts
 * so it is independently testable without mocking all of NextAuth.
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // Database sessions are stored in the Session table via Prisma adapter
  session: { strategy: "database" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        const user = await authorizeCredentials(prisma, credentials ?? {});

        if (!user) return null;

        // NextAuth v4 User shape - id is required
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * Attach `user.id` to the session so Client Components and tRPC
     * procedures can read it without an extra DB query.
     *
     * `session.user` already has name/email/image from the adapter.
     * Whe only extend with `id` - never add sensitive fields here.
     */
    session({ session, user }: { session: Session; user: User }): Session {
      session.user.id = user.id;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  // NEXTAUTH_SECRET is read automatically by NextAuth v4 from env
  // Explicit assignment is not required but clarifies the dependency
  secret: serverEnv.NEXTAUTH_SECRET,
};
