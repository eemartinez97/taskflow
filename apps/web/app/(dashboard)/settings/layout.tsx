import type { JSX, ReactNode } from "react";

import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";
import { SettingsNav } from "./_components/settings-nav";

interface SettingsLayoutProps {
  children: ReactNode;
}

export default async function SettingsLayout({
  children,
}: SettingsLayoutProps): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);
  const role = org?.memberships[0]?.role ?? null;

  return (
    <div className="flex gap-10">
      <SettingsNav orgName={org?.name ?? null} role={role} />
      <div className="flex min-w-0 max-w-2xl flex-1 flex-col gap-6">{children}</div>
    </div>
  );
}
