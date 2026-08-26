"use client";

import { Building2, Mail } from "lucide-react";
import type { JSX } from "react";

import { Badge, Button } from "@taskflow/ui";

import { EmptyState } from "@/components/common/empty-state";
import { api } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils/date";
import { useInvitationActions } from "./use-invitation-actions";

/**
 * The signed-in user's own pending org invitations. Renders `null` while
 * loading (no flash of an empty state), the shared `EmptyState` once loaded
 * with none, so it can be dropped in unconditionally wherever it's mounted
 * (the standalone /invitations page, the no-org empty state - the latter
 * only ever mounts this once it already knows there's at least one, via its
 * own `hasPendingInvitations` check, so the EmptyState branch below is
 * reachable only from /invitations in practice).
 */
export function PendingInvitations(): JSX.Element | null {
  const { data: invitations } = api.invitations.listMine.useQuery();
  const { accept, decline, isAccepting, isDeclining } = useInvitationActions();

  if (!invitations) return null;

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No pending invitations"
        description="You'll see any invitations to join an organization here."
      />
    );
  }

  return (
    <section aria-labelledby="pending-invitations-heading" className="flex flex-col gap-3">
      <h2 id="pending-invitations-heading" className="text-sm font-semibold text-gray-900">
        Pending invitations ({invitations.length})
      </h2>

      <ul className="flex flex-col gap-2">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{inv.orgName}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{inv.role}</Badge>
                  <span className="text-xs text-gray-500">Expires {formatDate(inv.expiresAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isDeclining}
                onClick={() => {
                  decline({ invitationId: inv.id });
                }}
              >
                Decline
              </Button>
              <Button
                size="sm"
                disabled={isAccepting}
                onClick={() => {
                  accept({ invitationId: inv.id });
                }}
              >
                Accept
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
