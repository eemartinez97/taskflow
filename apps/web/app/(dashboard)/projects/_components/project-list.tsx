"use client";

import { useState, type JSX } from "react";
import { FolderPlus } from "lucide-react";
import Link from "next/link";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";
import type { OrgWithMembership, Project } from "@taskflow/database";

import { CreateProjectDialog } from "./create-project-dialog";
import { api } from "@/lib/trpc/client";

interface ProjectListProps {
  orgId: string;
  initialOrg: OrgWithMembership;
  initialProjects: Project[];
}

/**
 * Client Component — receives server-prefetched data and stays live via TanStack Query.
 *
 * TanStack Query v5: `useQuery` object-form only; no `isInitialLoading`.
 */
export function ProjectList({ orgId, initialOrg, initialProjects }: ProjectListProps): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: projects } = api.projects.list.useQuery(
    { orgId },
    { initialData: initialProjects },
  );

  const userRole = initialOrg.memberships[0]?.role ?? "VIEWER";
  const canCreate = userRole === "OWNER" || userRole === "ADMIN" || userRole === "MEMBER";

  return (
    <section aria-labelledby="projects-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="projects-heading" className="text-lg font-semibold text-gray-900">
          {initialOrg.name}
        </h2>

        {canCreate && (
          <Button
            size="sm"
            onClick={() => {
              setDialogOpen(true);
            }}
            aria-label="Create new project"
          >
            <FolderPlus className="mr-1.5 h-4 w-4" />
            New Project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-gray-500">
          No projects yet.{canCreate ? " Create one to get started." : ""}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Projects list">
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/dashboard/projects/${project.id}`} className="block">
                <Card className="transition-shadow hover:shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{project.key}</Badge>
                      <CardTitle className="text-sm">{project.name}</CardTitle>
                    </div>
                  </CardHeader>
                  {project.description && (
                    <CardContent>
                      <p className="line-clamp-2 text-xs text-gray-500">{project.description}</p>
                    </CardContent>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateProjectDialog
        orgId={orgId}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
        }}
        onCreated={() => {
          setDialogOpen(false);
        }}
      />
    </section>
  );
}
