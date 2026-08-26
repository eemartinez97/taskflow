import type { Metadata } from "next";
import type { JSX } from "react";

import { NoOrgState } from "@/components/common/no-org-state";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { canAdminOrg } from "@/lib/utils/role";
import { LabelManager } from "../_components/label-manager";

export const metadata: Metadata = { title: "Labels" };

/**
 * labels.list is read-only for every role including VIEWER - LabelManager's
 * own canManage prop (OWNER/ADMIN only) hides create/delete for everyone
 * else rather than gating the whole route for them.
 */
export default async function LabelsSettingsPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Create an organization to manage labels here." />;
  }

  const role = org.memberships[0]?.role ?? "VIEWER";
  const labels = await trpc.labels.list({ orgId: org.id });

  return (
    <>
      <h2 className="text-lg font-semibold text-gray-900">Labels</h2>
      <LabelManager orgId={org.id} initialLabels={labels} canManage={canAdminOrg(role)} />
    </>
  );
}
