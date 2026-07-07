import "server-only";

import { type SessionUser } from "@taskflow/shared";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getServerSessionFromHeaders } from "./server-session";

export async function getSession(): Promise<SessionUser | null> {
  const requestHeaders = await headers();
  return getServerSessionFromHeaders(requestHeaders);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
