import "server-only";

import { type SessionUser } from "@taskflow/shared";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function getSession(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user.id || !session.user.email) return null;

  const { id, email, name, image } = session.user;

  return {
    id,
    email,
    name: name ?? null,
    image: image ?? null,
  };
}
