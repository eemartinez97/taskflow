"use client";

import { useState, type JSX } from "react";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";
import type { OrgWithMembership, Project } from "@taskflow/database";

import { DropdownMenu } from "@/components/common/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { canAdminOrg, canMutateInOrg } from "@/lib/utils/role";
import { CreateProjectDialog } from "./create-project-dialog";
import { EditProjectDialog } from "./edit-project-dialog";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";

interface ProjectListProps {
  orgId: string;
  initialOrg: OrgWithMembership;
  initialProjects: Project[];
}

/**
 * Client Component - receives server-prefetched data and stays live via TanStack Query.
 *
 * TanStack Query v5: `useQuery` object-form only; no `isInitialLoading`.
 */
export function ProjectList({ orgId, initialOrg, initialProjects }: ProjectListProps): JSX.Element {
  const createDialog = useDisclosure();
  const utils = api.useUtils();

  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const { data: projects } = api.projects.list.useQuery(
    { orgId },
    { initialData: initialProjects },
  );

  const deleteMutation = api.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted.");
      void utils.projects.list.invalidate();
      setDeleteTarget(null);
    },
  });

  const userRole = initialOrg.memberships[0]?.role ?? "VIEWER";
  const canCreate = canMutateInOrg(userRole);
  const canAdmin = canAdminOrg(userRole);

  return (
    <section aria-labelledby="projects-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="projects-heading" className="text-lg font-semibold text-gray-900">
          {initialOrg.name}
        </h2>

        {canCreate && (
          <Button size="sm" onClick={createDialog.open} aria-label="Create new project">
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
              <Link href={`/projects/${project.id}`} className="block">
                <Card className="transition-shadow hover:shadow-sm">
                  <CardHeader spacing={project.description ? "compact" : "none"}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline">{project.key}</Badge>
                        <CardTitle className="text-sm">{project.name}</CardTitle>
                      </div>
                      {canAdmin && (
                        <DropdownMenu
                          triggerLabel={`Options for ${project.name}`}
                          items={[
                            {
                              label: "Edit",
                              icon: Pencil,
                              onClick: () => {
                                setEditTarget(project);
                              },
                            },
                            {
                              label: "Delete",
                              icon: Trash2,
                              danger: true,
                              onClick: () => {
                                setDeleteTarget(project);
                              },
                            },
                          ]}
                        />
                      )}
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
        open={createDialog.isOpen}
        onClose={createDialog.close}
        onCreated={createDialog.close}
      />

      {editTarget && (
        <EditProjectDialog
          project={editTarget}
          orgId={orgId}
          open={!!editTarget}
          onClose={() => {
            setEditTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ orgId, projectId: deleteTarget.id });
        }}
        title="Delete project"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This will permanently remove all boards, columns, and tasks.`}
        confirmLabel="Delete project"
        loading={deleteMutation.isPending}
        danger
      />
    </section>
  );
}
