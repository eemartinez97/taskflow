/**
 * NextAuth v4 type augmentation.
 *
 * By default NextAuth v4 Session.user only has name, email, image.
 * We extend it with `id` so tRPC context and Client Components can
 * read the user id from the session without extra DB round-trips.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
