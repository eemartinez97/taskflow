"use client";

import { useEffect, useState, type RefObject } from "react";

import {
  SOCKET_EVENTS,
  type ServerToClientEvents,
  type SocketPresenceUser,
} from "@taskflow/shared";

import type { AppSocket } from "@/lib/socket/client";

/**
 * Who else is viewing this board. Subscribes to the presence events the
 * server has been broadcasting all along (nothing consumed them until now).
 *
 * Must be called AFTER the hook that creates the socket, in the same
 * component: effects run in declaration order, so the ref is populated.
 */
export function usePresence(socketRef: RefObject<AppSocket | null>): SocketPresenceUser[] {
  const [users, setUsers] = useState<SocketPresenceUser[]>([]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onSync: ServerToClientEvents[typeof SOCKET_EVENTS.PRESENCE_SYNC] = ({
      users: roster,
    }) => {
      setUsers(roster);
    };

    const onJoin: ServerToClientEvents[typeof SOCKET_EVENTS.PRESENCE_JOIN] = (user) => {
      setUsers((prev) => (prev.some((u) => u.userId === user.userId) ? prev : [...prev, user]));
    };

    const onLeave: ServerToClientEvents[typeof SOCKET_EVENTS.PRESENCE_LEAVE] = ({ userId }) => {
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
    };

    socket.on(SOCKET_EVENTS.PRESENCE_SYNC, onSync);
    socket.on(SOCKET_EVENTS.PRESENCE_JOIN, onJoin);
    socket.on(SOCKET_EVENTS.PRESENCE_LEAVE, onLeave);

    return () => {
      socket.off(SOCKET_EVENTS.PRESENCE_SYNC, onSync);
      socket.off(SOCKET_EVENTS.PRESENCE_JOIN, onJoin);
      socket.off(SOCKET_EVENTS.PRESENCE_LEAVE, onLeave);
      setUsers([]);
    };
  }, [socketRef]);

  return users;
}
