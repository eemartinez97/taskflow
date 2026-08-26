import type { Metadata } from "next";
import type { JSX } from "react";

import { NoOrgState } from "@/components/common/no-org-state";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { getSession } from "@/lib/auth/session";
import { canAdminOrg } from "@/lib/utils/role";
import { TeamClient } from "./_components/team-client";

interface TeamPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Dynamic per-org title (e.g. "Acme · Team") so a user with several orgs
 * open in different tabs can tell them apart - static "Team" would render
 * identically for every org. getOrgOrNull is React cache()-wrapped, so this
 * and the page body below dedupe to a single orgs.list() call per request.
 */
export async function generateMetadata(): Promise<Metadata> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);
  return { title: org ? `${org.name} · Team` : "Team" };
}

/**
 * Shows the roster + invitations for the active org (the one the sidebar
 * switcher currently has selected) - no [orgId] segment, unlike the old
 * /organizations/[orgId] this replaced. `invitations.listForOrg` is only
 * fetched for an admin/owner - calling it as a non-admin throws FORBIDDEN
 * through the RSC caller and would 500 the page.
 */
export default async function TeamPage({ searchParams }: TeamPageProps): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Team members are managed inside an organization." />;
  }

  const role = org.memberships[0]?.role ?? "VIEWER";
  const canAdmin = canAdminOrg(role);

  const [members, invitations, session, params] = await Promise.all([
    trpc.orgs.members({ orgId: org.id }),
    canAdmin ? trpc.invitations.listForOrg({ orgId: org.id }) : Promise.resolve([]),
    getSession(),
    searchParams,
  ]);

  // `from` is the orgId a stale /organizations/<orgId> deep link (an old
  // notification) pointed at - proxy.ts can't verify membership itself (it's
  // deliberately DB-free), so getOrgOrNull's own cookie self-heal may have
  // silently landed the caller on a different org than the link intended.
  // Only worth flagging when it actually diverged - a fresh, valid deep link
  // has from === org.id and needs no toast.
  const fromParam = params.from;
  const requestedOrgId = typeof fromParam === "string" ? fromParam : undefined;
  const staleOrgLink = requestedOrgId !== undefined && requestedOrgId !== org.id;

  return (
    <TeamClient
      orgId={org.id}
      orgName={org.name}
      currentUserId={session?.id ?? ""}
      currentUserRole={role}
      initialMembers={members}
      initialInvitations={invitations}
      staleOrgLink={staleOrgLink}
    />
  );
}
