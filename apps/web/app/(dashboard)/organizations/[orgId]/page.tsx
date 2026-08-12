import type { Metadata } from "next";
import { cache, type JSX } from "react";

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgByIdOrNotFound } from "@/lib/utils/org-utils";
import { getSession } from "@/lib/auth/session";
import { canAdminOrg } from "@/lib/utils/role";
import { OrgDetailClient } from "./_components/org-detail-client";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

/**
 * Deduped per request with React cache(): generateMetadata AND the page body
 * both resolve the same org. `invitations.listForOrg` is only fetched for
 * an admin/owner - calling it as a non-admin throws FORBIDDEN through the
 * RSC caller and would 500 the page.
 */
const getOrgDetailContext = cache(async (orgId: string) => {
  const trpc = await getServerTRPC();
  const org = await getOrgByIdOrNotFound(trpc, orgId);
  const role = org.memberships[0]?.role ?? "VIEWER";
  const canAdmin = canAdminOrg(role);

  const [members, invitations] = await Promise.all([
    trpc.orgs.members({ orgId }),
    canAdmin ? trpc.invitations.listForOrg({ orgId }) : Promise.resolve([]),
  ]);

  return { org, role, members, invitations };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orgId } = await params;

  try {
    const { org } = await getOrgDetailContext(orgId);
    return { title: org.name };
  } catch {
    return { title: "Organization" };
  }
}

export default async function OrganizationDetailPage({ params }: PageProps): Promise<JSX.Element> {
  const { orgId } = await params;
  const [{ org, role, members, invitations }, session] = await Promise.all([
    getOrgDetailContext(orgId),
    getSession(),
  ]);

  return (
    <OrgDetailClient
      orgId={org.id}
      orgName={org.name}
      currentUserId={session?.id ?? ""}
      currentUserRole={role}
      initialMembers={members}
      initialInvitations={invitations}
    />
  );
}
