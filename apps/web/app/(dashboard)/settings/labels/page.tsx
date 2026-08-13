import type { Metadata } from "next";
import type { JSX } from "react";
import { Lock } from "lucide-react";

import { NoOrgState } from "@/components/common/no-org-state";
import { EmptyState } from "@/components/common/empty-state";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { canAdminOrg } from "@/lib/utils/role";
import { LabelManager } from "../_components/label-manager";

export const metadata: Metadata = { title: "Labels" };

/**
 * labels.list is member-readable (VIEWER excluded) - a VIEWER hitting this
 * route directly gets the access-denied state below instead of a FORBIDDEN
 * crash out of the RSC fetch. A plain MEMBER can view but not
 * create/delete - LabelManager's own canManage prop hides that half of the
 * UI rather than gating the whole route for them.
 */
export default async function LabelsSettingsPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Create an organization to manage labels here." />;
  }

  const role = org.memberships[0]?.role ?? "VIEWER";

  if (role === "VIEWER") {
    return (
      <EmptyState
        icon={Lock}
        title="You don't have access to this page"
        description="Viewers can't manage labels."
      />
    );
  }

  const labels = await trpc.labels.list({ orgId: org.id });

  return (
    <>
      <h2 className="text-lg font-semibold text-gray-900">Labels</h2>
      <LabelManager orgId={org.id} initialLabels={labels} canManage={canAdminOrg(role)} />
    </>
  );
}
