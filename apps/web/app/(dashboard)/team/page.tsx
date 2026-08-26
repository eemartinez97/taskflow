import type { Metadata } from "next";
import type { JSX } from "react";

import { NoOrgState } from "@/components/common/no-org-state";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { getSession } from "@/lib/auth/session";
import { canAdminOrg } from "@/lib/utils/role";
import { TeamClient } from "./_components/team-client";

export const metadata: Metadata = { title: "Team" };

/**
 * Shows the roster + invitations for the active org (the one the sidebar
 * switcher currently has selected) - no [orgId] segment, unlike the old
 * /organizations/[orgId] this replaced. `invitations.listForOrg` is only
 * fetched for an admin/owner - calling it as a non-admin throws FORBIDDEN
 * through the RSC caller and would 500 the page.
 */
export default async function TeamPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Team members are managed inside an organization." />;
  }

  const role = org.memberships[0]?.role ?? "VIEWER";
  const canAdmin = canAdminOrg(role);

  const [members, invitations, session] = await Promise.all([
    trpc.orgs.members({ orgId: org.id }),
    canAdmin ? trpc.invitations.listForOrg({ orgId: org.id }) : Promise.resolve([]),
    getSession(),
  ]);

  return (
    <TeamClient
      orgId={org.id}
      orgName={org.name}
      currentUserId={session?.id ?? ""}
      currentUserRole={role}
      initialMembers={members}
      initialInvitations={invitations}
    />
  );
}
