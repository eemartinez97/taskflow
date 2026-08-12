"use client";

import { useEffect } from "react";

import { SOCKET_EVENTS, type ServerToClientEvents } from "@taskflow/shared";

import { createSocket } from "@/lib/socket/client";
import { api } from "@/lib/trpc/client";

/**
 * Keeps an org's admin invitations table (and member roster, on accept)
 * live across every open viewer - an accept/decline/revoke from anywhere
 * refreshes this screen without a manual reload.
 *
 * Opens its own connection rather than piggybacking on the always-mounted
 * global socket in Header (same tradeoff useBoardRealtime already makes for
 * board pages): org rooms are joined automatically for every authenticated
 * socket at handshake, so no query param is needed to receive
 * INVITATION_RESOLVED here.
 */
export function useOrgInvitationsRealtime(orgId: string): void {
  const utils = api.useUtils();

  useEffect(() => {
    const socket = createSocket();
    if (!socket) return;

    socket.connect();

    const onInvitationResolved: ServerToClientEvents[typeof SOCKET_EVENTS.INVITATION_RESOLVED] = (
      payload,
    ) => {
      if (payload.orgId !== orgId) return;
      void utils.invitations.listForOrg.invalidate({ orgId });
      if (payload.status === "ACCEPTED") void utils.orgs.members.invalidate({ orgId });
    };

    socket.on(SOCKET_EVENTS.INVITATION_RESOLVED, onInvitationResolved);

    return () => {
      socket.off(SOCKET_EVENTS.INVITATION_RESOLVED, onInvitationResolved);
      socket.disconnect();
    };
  }, [utils, orgId]);
}
