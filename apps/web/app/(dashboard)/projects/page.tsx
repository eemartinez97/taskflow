import type { Metadata } from "next";
import type { JSX } from "react";

import { NoOrgState } from "@/components/common/no-org-state";
import { ProjectList } from "./_components/project-list";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Projects" };

/**
 * Projects listing page - Server Component.
 *
 * Prefetches org + project data on the server so the client gets
 * a populated page immediately without a loading flash.
 *
 * projects.list is read-only for every role including VIEWER - ProjectList
 * itself hides the "New Project" button and the per-project edit/delete menu
 * (canMutateInOrg/canAdminOrg) for roles that can't act on them.
 */
export default async function ProjectsPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Projects are grouped inside organizations." />;
  }

  const projects = await trpc.projects.list({ orgId: org.id });

  return <ProjectList orgId={org.id} initialOrg={org} initialProjects={projects} />;
}
