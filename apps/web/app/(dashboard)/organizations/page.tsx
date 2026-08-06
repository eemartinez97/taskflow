import type { Metadata } from "next";
import type { JSX } from "react";

import { getServerTRPC } from "@/lib/trpc/server";
import { OrganizationsClient } from "./_components/organizations-client";

export const metadata: Metadata = { title: "Organizations" };

/**
 * Organization management. Lists every org the user belongs to (multi-org),
 * with edit for managers and delete for owners. Creating a new org opens
 * CreateOrgDialog - the same modal as the sidebar switcher.
 */
export default async function OrganizationsPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const orgs = await trpc.orgs.list();

  return <OrganizationsClient initialOrgs={orgs} />;
}
