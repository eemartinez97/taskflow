import NextAuth from "next-auth";

import { authOptions } from "@/auth";

/**
 * NextAuth v4 route handler for Next.js App Router.
 *
 * Binds the GET and POST handlers by NextAuth v4.
 * Do NOT use the v5 pattern (`export const { GET, POST } = handlers`) -
 * that API does not exist in v4.
 */

const handler = NextAuth(authOptions) as unknown as (req: Request) => Promise<Response>;

export { handler as GET, handler as POST };
