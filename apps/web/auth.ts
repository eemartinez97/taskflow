import "server-only";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions, Session, User } from "next-auth";
import { authorizeCredentials } from "@/lib/auth/credentials";
import { serverEnv } from "@/lib/env.server";
import { prisma } from "@taskflow/database";
import type { JWT } from "next-auth/jwt";

/**
 * NextAuth v4 - JWT strategy (required for CredentialsProvider).
 *
 * KEY CONSTRAINTS:
 * - NO adapter: PrismaAdapter - incompatible with Credentials + JWT
 * - strategy: "jwt" - mandatory with CredentialsProvider
 * - session callback receives `token`, NOT `user` (database strategy only)
 * - NEXTAUTH_SECRET (not AUTH_SECRET)
 * - getServerSession(authOptions) for server access
 * - useSession() for client access
 * - NEVER call the v5-only auth() helper
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

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
     * JWT callback - runs on every sign-in and every session read.
     * `user` is only present on the initial sign-in.
     * Persist user.id onto the token so session callback can read it.
     */
    jwt({
      token,
      user,
      trigger,
      session,
    }: {
      token: JWT;
      user?: User | null;
      trigger?: "signIn" | "signUp" | "update";
      session?: { name?: string | null; image?: string | null };
    }): JWT {
      if (user) token.id = user.id;

      // useSession().update({...}) from the profile form lands here, so the
      // header reflects the new name/avatar without a re-login.
      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.picture = session.image;
      }

      return token;
    },

    /**
     * Attach `user.id` to the session so Client Components and tRPC
     * procedures can read it without an extra DB query.
     *
     * `session.user` already has name/email/image from the adapter.
     * We only extend with `id` - never add sensitive fields here.
     */
    session({ session, token }): Session {
      if (token.id) {
        session.user.id = token.id;
      }
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
