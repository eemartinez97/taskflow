"use client";

import { type JSX, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import type { OrgWithMembership } from "@taskflow/database";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EditOrgDialog } from "./edit-org-dialog";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { canAdminOrg, isOrgOwner } from "@/lib/utils/role";
import { clearActiveOrgId, setActiveOrgId } from "@/lib/utils/active-org";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { CreateOrgDialog } from "@/components/organizations/create-org-dialog";

interface OrganizationsClientProps {
  initialOrgs: OrgWithMembership[];
}

export function OrganizationsClient({ initialOrgs }: OrganizationsClientProps): JSX.Element {
  const router = useRouter();
  const utils = api.useUtils();
  const deleteDialog = useDisclosure();
  const createDialog = useDisclosure();

  const [editTarget, setEditTarget] = useState<OrgWithMembership | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgWithMembership | null>(null);

  const { data: orgs } = api.orgs.list.useQuery(undefined, { initialData: initialOrgs });

  const deleteMutation = api.orgs.delete.useMutation({
    onSuccess: (_res, { orgId }) => {
      toast.success("Organization deleted.");
      // Reset the active org so getOrgOrNull self-heals to a remaining one.
      clearActiveOrgId();
      void utils.orgs.list.invalidate();
      setDeleteTarget(null);
      deleteDialog.close();
      router.refresh();
      void orgId;
    },
  });

  return (
    <section aria-labelledby="orgs-heading" className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 id="orgs-heading" className="text-lg font-semibold text-gray-900">
          Your organizations ({orgs.length})
        </h2>
        <Button size="sm" onClick={createDialog.open}>
          <Plus className="mr-1.5 h-4 w-4" />
          New organization
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {orgs.map((org) => {
          const role = org.memberships[0]?.role ?? "VIEWER";
          return (
            <li key={org.id}>
              <Card>
                <CardHeader spacing="compact">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <CardTitle className="text-sm">{org.name}</CardTitle>
                      <Badge variant={isOrgOwner(role) ? "default" : "outline"}>{role}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {canAdminOrg(role) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${org.name}`}
                          onClick={() => {
                            setEditTarget(org);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {isOrgOwner(role) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${org.name}`}
                          onClick={() => {
                            setDeleteTarget(org);
                            deleteDialog.open();
                          }}
                          className="text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-400">/{org.slug}</p>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <CreateOrgDialog
        open={createDialog.isOpen}
        onClose={createDialog.close}
        onCreated={(orgId) => {
          setActiveOrgId(orgId);
          createDialog.close();
          router.refresh();
        }}
      />

      {editTarget && (
        <EditOrgDialog
          org={editTarget}
          open={!!editTarget}
          onClose={() => {
            setEditTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onClose={() => {
          setDeleteTarget(null);
          deleteDialog.close();
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ orgId: deleteTarget.id });
        }}
        title="Delete organization"
        description={`You are about to permanently delete "${deleteTarget?.name ?? ""}" and all of its projects, boards and tasks.`}
        confirmText={deleteTarget?.name ?? ""}
        confirmLabel="Yes, delete everything"
        loading={deleteMutation.isPending}
        danger
      />
    </section>
  );
}
