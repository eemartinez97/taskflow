"use client";

import { UserPlus } from "lucide-react";
import { useEffect, type JSX } from "react";

import type { MembershipWithUser } from "@taskflow/database";
import type { OrgInvitation, Role } from "@taskflow/shared";
import { Badge, Button } from "@taskflow/ui";

import { InvitationsSection } from "./invitations-section";
import { InviteDialog } from "./invite-dialog";
import { MembersSection } from "./members-section";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { useOrgInvitationsRealtime } from "@/lib/hooks/use-org-invitations-realtime";
import { canAdminOrg, isOrgOwner } from "@/lib/utils/role";
import { toast } from "@/lib/toast/store";

interface TeamClientProps {
  orgId: string;
  orgName: string;
  currentUserId: string;
  currentUserRole: Role;
  initialMembers: MembershipWithUser[];
  initialInvitations: OrgInvitation[];
  /** True when a /organizations/<orgId> deep link pointed at an org the caller no longer belongs to. */
  staleOrgLink: boolean;
}

export function TeamClient({
  orgId,
  orgName,
  currentUserId,
  currentUserRole,
  initialMembers,
  initialInvitations,
  staleOrgLink,
}: TeamClientProps): JSX.Element {
  const inviteDialog = useDisclosure();
  const canAdmin = canAdminOrg(currentUserRole);

  useOrgInvitationsRealtime(orgId);

  useEffect(() => {
    if (staleOrgLink) {
      toast.info(
        "That link pointed to an organization you're no longer part of - showing your default one instead.",
      );
    }
    // Only meant to fire once, for the org this page happened to be
    // server-rendered with - not a live state that needs re-checking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">{orgName}</h2>
          <Badge variant={isOrgOwner(currentUserRole) ? "default" : "outline"}>
            {currentUserRole}
          </Badge>
        </div>

        {canAdmin && (
          <Button size="sm" onClick={inviteDialog.open}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Invite member
          </Button>
        )}
      </div>

      <MembersSection
        orgId={orgId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        initialMembers={initialMembers}
        onInviteClick={inviteDialog.open}
      />

      {canAdmin && <InvitationsSection orgId={orgId} initialInvitations={initialInvitations} />}

      <InviteDialog orgId={orgId} open={inviteDialog.isOpen} onClose={inviteDialog.close} />
    </div>
  );
}
