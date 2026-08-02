import type { Metadata } from "next";
import type { JSX } from "react";

import { LabelManager } from "./_components/label-manager";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { ProfileForm } from "./_components/profile-form";
import { CursorPreference } from "./_components/cursor-preference";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
        <ProfileForm />
        <CursorPreference />
        <p className="text-sm text-gray-500">Create an organization to manage labels here.</p>{" "}
      </div>
    );
  }

  const labels = await trpc.labels.list({ orgId: org.id });

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
      <ProfileForm />
      <CursorPreference />
      <LabelManager orgId={org.id} initialLabels={labels} />
    </div>
  );
}
