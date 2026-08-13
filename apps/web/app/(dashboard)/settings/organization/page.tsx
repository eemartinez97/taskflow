import type { Metadata } from "next";
import type { JSX } from "react";
import { Lock } from "lucide-react";

import { NoOrgState } from "@/components/common/no-org-state";
import { EmptyState } from "@/components/common/empty-state";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { canAdminOrg } from "@/lib/utils/role";
import { OrganizationSection } from "../_components/organization-section";
import { LeaveOrgSection } from "../_components/leave-org-section";

export const metadata: Metadata = { title: "Organization" };

/**
 * Gated by ROUTE, not by hiding a card: SettingsNav already hides this link
 * from anyone who isn't OWNER/ADMIN, but the route itself still checks -
 * someone who was demoted, or who just types the URL, gets an explicit
 * access-denied state here instead of a stale form silently failing to save.
 */
export default async function OrganizationSettingsPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Create an organization to manage its settings here." />;
  }

  const role = org.memberships[0]?.role ?? "VIEWER";

  return (
    <>
      <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
      {canAdminOrg(role) ? (
        <OrganizationSection org={org} role={role} />
      ) : (
        <EmptyState
          icon={Lock}
          title="You don't have access to this page"
          description="Only organization owners and admins can manage these settings."
        />
      )}
      <LeaveOrgSection orgId={org.id} orgName={org.name} role={role} />
    </>
  );
}
