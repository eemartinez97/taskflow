import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { JSX } from "react";

import { NoOrgState } from "@/components/common/no-org-state";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Team" };

/**
 * Kept (not deleted) as a redirect target: existing `Notification` rows with
 * `entityType: "org"` created before the invitations epic still link here.
 */
export default async function TeamPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Team members are managed inside an organization." />;
  }

  redirect(`/organizations/${org.id}`);
}
