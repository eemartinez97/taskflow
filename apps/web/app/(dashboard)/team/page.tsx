import type { Metadata } from "next";
import type { JSX } from "react";

import { NoOrgState } from "@/components/common/no-org-state";
import { TeamClient } from "./_components/team-client";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage(): Promise<JSX.Element> {
  const [trpc, session] = await Promise.all([getServerTRPC(), getSession()]);
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Team members are managed inside an organization." />;
  }

  const members = await trpc.orgs.members({ orgId: org.id });

  return (
    <TeamClient
      orgId={org.id}
      currentUserId={session?.id ?? ""}
      currentUserRole={org.memberships[0]?.role ?? "VIEWER"}
      initialMembers={members}
    />
  );
}
