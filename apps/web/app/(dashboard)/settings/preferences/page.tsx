import type { Metadata } from "next";
import type { JSX } from "react";

import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { CursorPreference } from "../_components/cursor-preference";

export const metadata: Metadata = { title: "Preferences" };

/**
 * The cursor preference lives on a Membership row, so it needs an org to
 * attach to - a user with no org yet just doesn't see the card, rather than
 * one wired to an orgId that doesn't exist.
 */
export default async function PreferencesSettingsPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  return (
    <>
      <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
      {org && <CursorPreference orgId={org.id} />}
    </>
  );
}
