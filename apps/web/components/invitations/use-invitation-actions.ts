"use client";

import { api } from "@/lib/trpc/client";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { setActiveOrgId } from "@/lib/utils/active-org";

export interface UseInvitationActionsResult {
  /** Accepts an invitation by id or token. Callers may pass a second `mutate`-style
   * options argument (e.g. `{ onSuccess }`) for surface-specific behavior - it
   * runs IN ADDITION TO the shared side effects below, never instead of them. */
  accept: ReturnType<typeof api.invitations.accept.useMutation>["mutate"];
  decline: ReturnType<typeof api.invitations.decline.useMutation>["mutate"];
  isAccepting: boolean;
  isDeclining: boolean;
}

/**
 * Single source of truth for every side effect of accepting/declining an
 * invitation, shared by every surface that can trigger one (the pending-
 * invitations list, the notifications panel's inline actions, and the
 * standalone /invitations/[token] page) so the invalidation list can't
 * drift between them.
 *
 * Accept also calls `setActiveOrgId` - the invitee is now a member, so the
 * org they just joined becomes their active one (matches CreateOrgDialog's
 * own onCreated behavior elsewhere in the app).
 */
export function useInvitationActions(): UseInvitationActionsResult {
  const router = useAppRouter();
  const utils = api.useUtils();

  function invalidateAfterResolution(): void {
    void utils.invitations.listMine.invalidate();
    void utils.orgs.list.invalidate();
    void utils.notifications.list.invalidate();
  }

  const acceptMutation = api.invitations.accept.useMutation({
    onSuccess: (result) => {
      setActiveOrgId(result.orgId);
      invalidateAfterResolution();
      router.refresh();
    },
  });

  const declineMutation = api.invitations.decline.useMutation({
    onSuccess: () => {
      invalidateAfterResolution();
      router.refresh();
    },
  });

  return {
    accept: acceptMutation.mutate,
    decline: declineMutation.mutate,
    isAccepting: acceptMutation.isPending,
    isDeclining: declineMutation.isPending,
  };
}
