"use client";

import { Mail, RotateCw, XCircle } from "lucide-react";
import { useState, type JSX } from "react";

import type { OrgInvitation } from "@taskflow/shared";
import { Badge, Button, type BadgeProps } from "@taskflow/ui";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils/date";

interface InvitationsSectionProps {
  orgId: string;
  initialInvitations: OrgInvitation[];
}

type DisplayStatus = OrgInvitation["status"] | "EXPIRED";

const STATUS_COLORS: Record<DisplayStatus, NonNullable<BadgeProps["variant"]>> = {
  PENDING: "warning",
  ACCEPTED: "success",
  DECLINED: "outline",
  REVOKED: "outline",
  EXPIRED: "outline",
};

/**
 * PENDING renders as "Expired" once past its expiry - no stored EXPIRED
 * status, see the Invitation model's docblock. Computed from `expiresAt` at
 * render time (not a server-fetched boolean) so a row doesn't keep showing
 * PENDING after it actually expires just because the query result is still
 * cached.
 */
function displayStatus(invitation: OrgInvitation): DisplayStatus {
  const isExpired = new Date(invitation.expiresAt).getTime() < Date.now();
  return invitation.status === "PENDING" && isExpired ? "EXPIRED" : invitation.status;
}

/** Admin-only table of every invitation (any status) sent for this org, with resend/revoke on PENDING rows. */
export function InvitationsSection({
  orgId,
  initialInvitations,
}: InvitationsSectionProps): JSX.Element {
  const [revokeTarget, setRevokeTarget] = useState<OrgInvitation | null>(null);
  const utils = api.useUtils();

  const { data: invitations } = api.invitations.listForOrg.useQuery(
    { orgId },
    { initialData: initialInvitations },
  );

  function invalidate(): void {
    void utils.invitations.listForOrg.invalidate({ orgId });
  }

  const resendMutation = api.invitations.resend.useMutation({
    onSuccess: () => {
      toast.success("Invitation resent.");
      invalidate();
    },
  });

  const revokeMutation = api.invitations.revoke.useMutation({
    onSuccess: () => {
      toast.success("Invitation revoked.");
      invalidate();
      setRevokeTarget(null);
    },
  });

  return (
    <section aria-labelledby="invitations-heading">
      <h3 id="invitations-heading" className="mb-3 text-sm font-semibold text-gray-900">
        Invitations ({invitations.length})
      </h3>

      {invitations.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No invitations sent yet"
          description="Use the Invite member button above to bring someone onto the team."
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {invitations.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-gray-900">{inv.email}</span>
                <span className="text-xs text-gray-500">
                  Invited by {inv.inviterName ?? "someone"} · Expires {formatDate(inv.expiresAt)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline">{inv.role}</Badge>
                <Badge variant={STATUS_COLORS[displayStatus(inv)]}>{displayStatus(inv)}</Badge>

                {inv.status === "PENDING" && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Resend invitation to ${inv.email}`}
                      disabled={resendMutation.isPending}
                      onClick={() => {
                        resendMutation.mutate({ orgId, invitationId: inv.id });
                      }}
                      className="text-gray-400 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Revoke invitation to ${inv.email}`}
                      onClick={() => {
                        setRevokeTarget(inv);
                      }}
                      className="text-gray-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => {
          setRevokeTarget(null);
        }}
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate({ orgId, invitationId: revokeTarget.id });
        }}
        title="Revoke invitation"
        description={`Revoke the invitation sent to ${revokeTarget?.email ?? "this address"}?`}
        confirmLabel="Revoke"
        loading={revokeMutation.isPending}
        danger
      />
    </section>
  );
}
