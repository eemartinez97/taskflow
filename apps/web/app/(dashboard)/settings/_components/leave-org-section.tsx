"use client";

import { useState, type JSX } from "react";

import type { Role } from "@taskflow/shared";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { clearActiveOrgId } from "@/lib/utils/active-org";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";

interface LeaveOrgSectionProps {
  orgId: string;
  orgName: string;
  role: Role;
}

/**
 * Visible to every role, unlike OrganizationSection (rename/delete, admin
 * only) - leaving is a self-scoped action any member can take. The OWNER
 * role is the one exception: an org must always keep exactly one owner and
 * ownership transfer doesn't exist yet, so a sole owner's only exit is
 * deleting the org outright (see the danger zone above, when rendered).
 */
export function LeaveOrgSection({ orgId, orgName, role }: LeaveOrgSectionProps): JSX.Element {
  const router = useAppRouter();
  const utils = api.useUtils();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const leaveMutation = api.orgs.leave.useMutation({
    onSuccess: () => {
      toast.success(`You left ${orgName}.`);
      clearActiveOrgId();
      void utils.orgs.list.invalidate();
      setConfirmOpen(false);
      router.push("/projects");
    },
  });

  return (
    <>
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Leave organization</CardTitle>
        </CardHeader>
        <CardContent>
          {role === "OWNER" ? (
            <p className="text-sm text-gray-600">
              As the owner, you can&apos;t leave {orgName}. Delete the organization instead if you
              no longer need it.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-600">
                You&apos;ll lose access to {orgName}&apos;s projects, boards and tasks. You can
                rejoin later if someone invites you again.
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmOpen(true);
                }}
                className="shrink-0"
              >
                Leave
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
        }}
        onConfirm={() => {
          leaveMutation.mutate({ orgId });
        }}
        title="Leave organization"
        description={`Are you sure you want to leave "${orgName}"? You'll need a new invitation to rejoin.`}
        confirmLabel="Yes, leave"
        loading={leaveMutation.isPending}
        danger
      />
    </>
  );
}
