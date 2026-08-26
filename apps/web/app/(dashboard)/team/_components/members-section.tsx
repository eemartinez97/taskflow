"use client";

import { Trash2, Users } from "lucide-react";
import { useState, type JSX } from "react";

import type { MembershipWithUser } from "@taskflow/database";
import { Badge, Button, Select } from "@taskflow/ui";
import { ROLES, type Role } from "@taskflow/shared";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { canAdminOrg, isOrgOwner, ROLE_BADGE_VARIANT } from "@/lib/utils/role";
import { displayName } from "@/lib/utils/user";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { useOnlineUsers } from "@/lib/hooks/use-online-users";

interface MembersSectionProps {
  orgId: string;
  currentUserId: string;
  currentUserRole: Role;
  initialMembers: MembershipWithUser[];
  /** Opens the invite dialog mounted in TeamClient - the empty state's own CTA when you're the only member. */
  onInviteClick: () => void;
}

export function MembersSection({
  orgId,
  currentUserId,
  currentUserRole,
  initialMembers,
  onInviteClick,
}: MembersSectionProps): JSX.Element {
  const [removeTarget, setRemoveTarget] = useState<MembershipWithUser | null>(null);
  const utils = api.useUtils();

  const canAdmin = canAdminOrg(currentUserRole);

  const { data: members } = api.orgs.members.useQuery({ orgId }, { initialData: initialMembers });

  const onlineUserIds = useOnlineUsers();

  // The org roster carries only OTHER users (the server excludes self from
  // PRESENCE_ONLINE_SYNC), so fold the current user in explicitly - you are
  // always online to yourself. Also dedupes any StrictMode self-echo in dev.
  const isMemberOnline = (userId: string): boolean =>
    userId === currentUserId || onlineUserIds.has(userId);

  const roleMutation = api.orgs.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      void utils.orgs.members.invalidate({ orgId });
    },
  });

  const isOwner = isOrgOwner(currentUserRole);

  const removeMutation = api.orgs.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed.");
      void utils.orgs.members.invalidate({ orgId });
      // A removed member's tasks stay assigned to them (see apps/api's
      // removeMembershipAndNotify) - refresh so an already-open board/task
      // panel picks up the new ex-member instead of showing stale data.
      // useAssigneeLookup (what kanban-board.tsx/task-detail-panel.tsx
      // actually read) queries orgs.assigneeLookup, not orgs.formerAssignees
      // directly - invalidating the latter alone is a no-op for either view.
      void utils.orgs.assigneeLookup.invalidate({ orgId });
      setRemoveTarget(null);
    },
  });

  // The roster can never be empty (you're always in it), so "alone" is the
  // actual empty state here - and the only member of a fresh org is always
  // its OWNER (no other path adds a member - see Invitation.accept), so
  // gating the CTA on canAdmin is a formality that's never false in
  // practice, not a real branch to design around.
  const isAlone = members.length === 1;

  return (
    <section aria-labelledby="members-heading">
      <h3 id="members-heading" className="mb-3 text-sm font-semibold text-gray-900">
        Members ({members.length})
      </h3>

      {isAlone ? (
        <EmptyState
          icon={Users}
          title="You're the only one here"
          description="Invite teammates to assign tasks and see who's online."
          // Distinct from the header's own "Invite member" button (both are
          // visible at once here) - same accessible name on both would be a
          // real, not just test-visible, ambiguity for anyone navigating by
          // name (screen reader, browser "find"), not only Playwright's
          // strict-mode role queries.
          action={
            canAdmin ? { label: "Invite your first teammate", onClick: onInviteClick } : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  {isMemberOnline(m.userId) && (
                    <span
                      aria-label="Online"
                      className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500"
                    />
                  )}
                  {displayName(m.user)}
                </span>
                <span className="text-xs text-gray-500">{m.user.email}</span>
              </div>

              <div className="flex items-center gap-3">
                {isOwner && m.role !== "OWNER" && m.userId !== currentUserId ? (
                  <Select
                    aria-label={`Role for ${displayName(m.user)}`}
                    value={m.role}
                    disabled={roleMutation.isPending}
                    onChange={(e) => {
                      roleMutation.mutate({
                        orgId,
                        userId: m.userId,
                        data: { role: e.target.value as Exclude<Role, "OWNER"> },
                      });
                    }}
                    className="h-8 w-32 py-1 text-xs"
                  >
                    {ROLES.filter((r) => r !== "OWNER").map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge variant={ROLE_BADGE_VARIANT[m.role]}>{m.role}</Badge>
                )}

                {isOwner && m.userId !== currentUserId && m.role !== "OWNER" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${displayName(m.user)}`}
                    onClick={() => {
                      setRemoveTarget(m);
                    }}
                    className="text-gray-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => {
          setRemoveTarget(null);
        }}
        onConfirm={() => {
          if (removeTarget) removeMutation.mutate({ orgId, userId: removeTarget.userId });
        }}
        title="Remove member"
        description={`Remove ${removeTarget?.user.name ?? removeTarget?.user.email ?? "this member"} from the organization?`}
        confirmLabel="Remove"
        loading={removeMutation.isPending}
        danger
      />
    </section>
  );
}
