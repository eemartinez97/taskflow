"use client";

import { useEffect } from "react";

import { SOCKET_EVENTS, type ServerToClientEvents } from "@taskflow/shared";

import { createSocket } from "@/lib/socket/client";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
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
  }, [utils]);
}
