"use client";

import { useEffect } from "react";

import { SOCKET_EVENTS, type ServerToClientEvents } from "@taskflow/shared";

import { createSocket } from "@/lib/socket/client";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { readActiveOrgId } from "@/lib/utils/active-org";
import {
  addOnlineUser,
  removeOnlineUser,
  resetOnlineUsers,
  setOnlineUsers,
} from "../socket/presence-store";

/** The list endpoint returns at most 50 - keep the cache consistent with it. */
const MAX_CACHED_NOTIFICATIONS = 50;

/**
 * Single global realtime connection. Mounted ONCE (in the Header): opens the
 * one non-board socket and multiplexes every user-scoped event over it:
 *
 * - NOTIFICATION_CREATED  -> prepend to notifications.list cache + info toast
 *   (a MEMBER_LEFT notification additionally invalidates that org's
 *   members/formerAssignees/assigneeLookup/orgs.list caches, and refreshes
 *   the page if the affected org is the one currently in view - see below;
 *   a MEMBER_INVITED one invalidates invitations.listMine - see below)
 * - PRESENCE_ONLINE_SYNC  -> seed the org online roster
 * - PRESENCE_ONLINE       -> add a teammate to the roster
 * - PRESENCE_OFFLINE      -> remove a teammate from the roster
 *
 * Presence is exposed to the rest of the app via the presence store
 * (`useOnlineUsers`), so no other component opens a second socket.
 * The 30s notifications polling stays as a fallback for missed events.
 */
export function useGlobalRealtime(): void {
  const utils = api.useUtils();
  const router = useAppRouter();

  useEffect(() => {
    const socket = createSocket();
    if (!socket) return;

    socket.connect();

    const onNotificationCreated: ServerToClientEvents[typeof SOCKET_EVENTS.NOTIFICATION_CREATED] =
      ({ notification }) => {
        utils.notifications.list.setData(undefined, (prev) =>
          prev
            ? {
                notifications: [notification, ...prev.notifications].slice(
                  0,
                  MAX_CACHED_NOTIFICATIONS,
                ),
                unreadCount: prev.unreadCount + 1,
              }
            : prev,
        );

        toast.info(notification.message);

        // The notifications list cache above updates instantly, but the
        // panel's Accept/Decline buttons come from a SEPARATE query
        // (invitations.listMine) that this socket doesn't otherwise touch -
        // without this, a panel already open when the invite arrives shows
        // the message with no way to act on it until something else happens
        // to refetch listMine (a remount, a window refocus).
        if (notification.type === "MEMBER_INVITED") {
          void utils.invitations.listMine.invalidate();
        }

        // MEMBER_LEFT carries the org as entityId (see notifyMemberLeft) but
        // rides the generic NOTIFICATION_CREATED event rather than its own -
        // without this, an admin watching the Team roster or a board's
        // ex-member badges live sees only the toast; the roster/badges stay
        // stale until a manual reload.
        if (notification.type === "MEMBER_LEFT" && notification.entityId) {
          void utils.orgs.members.invalidate({ orgId: notification.entityId });
          void utils.orgs.formerAssignees.invalidate({ orgId: notification.entityId });
          // useAssigneeLookup (board/task-detail) reads the combined
          // assigneeLookup query, not members/formerAssignees directly - it
          // needs its own invalidation or a board left open during a
          // leave/removal keeps showing the stale roster.
          void utils.orgs.assigneeLookup.invalidate({ orgId: notification.entityId });
          // Always safe (protectedProcedure, no roleGuard) - keeps the org
          // switcher/sidebar correct regardless of who this recipient is.
          void utils.orgs.list.invalidate();

          // An admin-initiated removal notifies the removed member too (see
          // removeMembershipAndNotify), and the three invalidations above
          // would just 403 for THEM (their Membership is already gone) -
          // silently, since nothing here reads their isError state. Rather
          // than guess whether this recipient was the one removed,
          // router.refresh() re-runs every Server Component on the current
          // page whenever the notification's org is the one currently in
          // view - including getOrgOrNull's own self-heal (picks a
          // different org + cookie) and each page's existing
          // staleOrgLink/NoOrgState handling, the same recovery path a
          // stale deep link already goes through. For every OTHER recipient
          // (an unaffected admin/member watching the same org), this is
          // just a redundant background refresh - no visible behavior
          // change, since their own membership/data didn't go anywhere.
          if (readActiveOrgId() === notification.entityId) {
            router.refresh();
          }
        }
      };

    const onOnlineSync: ServerToClientEvents[typeof SOCKET_EVENTS.PRESENCE_ONLINE_SYNC] = ({
      userIds,
    }) => {
      setOnlineUsers(userIds);
    };

    const onOnline: ServerToClientEvents[typeof SOCKET_EVENTS.PRESENCE_ONLINE] = ({ userId }) => {
      addOnlineUser(userId);
    };

    const onOffline: ServerToClientEvents[typeof SOCKET_EVENTS.PRESENCE_OFFLINE] = ({ userId }) => {
      removeOnlineUser(userId);
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION_CREATED, onNotificationCreated);
    socket.on(SOCKET_EVENTS.PRESENCE_ONLINE_SYNC, onOnlineSync);
    socket.on(SOCKET_EVENTS.PRESENCE_ONLINE, onOnline);
    socket.on(SOCKET_EVENTS.PRESENCE_OFFLINE, onOffline);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION_CREATED, onNotificationCreated);
      socket.off(SOCKET_EVENTS.PRESENCE_ONLINE_SYNC, onOnlineSync);
      socket.off(SOCKET_EVENTS.PRESENCE_ONLINE, onOnline);
      socket.off(SOCKET_EVENTS.PRESENCE_OFFLINE, onOffline);
      socket.disconnect();
      resetOnlineUsers();
    };
  }, [utils, router]);
}
