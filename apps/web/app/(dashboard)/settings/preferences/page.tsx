import type { Metadata } from "next";
import type { JSX } from "react";

import { NoOrgState } from "@/components/common/no-org-state";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { CursorPreference } from "../_components/cursor-preference";

export const metadata: Metadata = { title: "Preferences" };

/**
 * The cursor preference lives on a Membership row, so it needs an org to
 * attach to - same NoOrgState fallback as the other org-scoped settings
 * pages (labels, organization), rather than silently rendering just the
 * bare heading with no card and no explanation.
 */
export default async function PreferencesSettingsPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Create an organization to manage preferences here." />;
  }

  return (
    <>
      <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
      <CursorPreference orgId={org.id} />
    </>
  );
}
