import type { Metadata } from "next";
import type { JSX } from "react";

import { ProjectList } from "./_components/project-list";
import { getServerTRPC } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Projects" };

/**
 * Projects listing page — Server Component.
 *
 * Prefetches org + project data on the server so the client gets
 * a populated page immediately without a loading flash.
 */
export default async function ProjectsPage(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();

  const orgs = await trpc.orgs.list();
  const org = orgs[0];

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-lg font-semibold text-gray-800">No organization found</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ask your team owner to invite you to an organization.
        </p>
      </div>
    );
  }

  const projects = await trpc.projects.list({ orgId: org.id });

  return <ProjectList orgId={org.id} initialOrg={org} initialProjects={projects} />;
}
