import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { JSX } from "react";

import { getServerTRPC } from "@/lib/trpc/server";
import { InvitationTokenClient } from "./_components/invitation-token-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = { title: "Invitation" };

/**
 * Deliberately NOT in proxy.ts's ALWAYS_ACCESSIBLE_ROUTES: requiring a
 * session before this page even renders is half the leaked-link defense (the
 * other half is `getByToken`'s WRONG_ACCOUNT state) - an anonymous visitor
 * falls through to `/login?callbackUrl=/invitations/<token>` instead.
 */
export default async function InvitationTokenPage({ params }: PageProps): Promise<JSX.Element> {
  const { token } = await params;
  const trpc = await getServerTRPC();

  const preview = await trpc.invitations.getByToken({ token }).catch(() => null);
  if (!preview) notFound();

  return <InvitationTokenClient token={token} preview={preview} />;
}
