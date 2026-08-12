"use client";

import { type JSX } from "react";
import { Building2 } from "lucide-react";

import { CreateOrgDialog } from "@/components/organizations/create-org-dialog";
import { PendingInvitations } from "@/components/invitations/pending-invitations";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { setActiveOrgId } from "@/lib/utils/active-org";
import { api } from "@/lib/trpc/client";

interface NoOrgStateProps {
  /** Optional context message shown below the main heading */
  context?: string;
}

/**
 * Shown when the current user has no organization.
 * Used across /projects, /tasks, /team, /settings.
 *
 * Single source of truth - never duplicate this empty state inline. Also
 * surfaces any pending invitations: "Ask your team owner to invite you" is
 * the wrong copy when an invite is already sitting in the user's inbox.
 */
export function NoOrgState({ context }: NoOrgStateProps): JSX.Element {
  const router = useAppRouter();
  const createDialog = useDisclosure();
  const { data: invitations } = api.invitations.listMine.useQuery();
  const hasPendingInvitations = (invitations?.length ?? 0) > 0;

  return (
    <div className="flex flex-col items-center gap-8 py-24 text-center">
      <div className="flex flex-col items-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <Building2 className="h-7 w-7 text-gray-400" />
        </div>

        <h2 className="text-base font-semibold text-gray-800">
          You&apos;re not part of any organization yet
        </h2>

        {context && <p className="mt-1 text-sm text-gray-500">{context}</p>}

        <p className="mt-3 text-sm text-gray-500">
          {hasPendingInvitations
            ? "Accept one of your pending invitations below, or "
            : "Ask your team owner to invite you, or "}
          <button
            type="button"
            onClick={createDialog.open}
            className="font-medium text-brand-600 underline-offset-2 hover:underline"
          >
            create one
          </button>
          .
        </p>
      </div>

      {hasPendingInvitations && (
        <div className="w-full max-w-sm text-left">
          <PendingInvitations />
        </div>
      )}

      <CreateOrgDialog
        open={createDialog.isOpen}
        onClose={createDialog.close}
        onCreated={(orgId) => {
          createDialog.close();
          setActiveOrgId(orgId);
          router.refresh();
        }}
      />
    </div>
  );
}
