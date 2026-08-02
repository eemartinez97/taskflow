"use client";

import { useEffect, useRef } from "react";

import { type AppSocket, createSocket } from "@/lib/socket/client";

/**
 * Manages the Socket.IO connection lifecycle for a project.
 *
 * - Creates a socket on mount, connects it, and tears it down on unmount.
 * - Returns the socket instance via a ref (stable - no re-render on connect).
 * - SSR-safe: `createSocket` returns null on the server.
 *
 * SRP: This hook owns ONLY connection lifecycle.
 * Event subscriptions live in `useBoardRealtime`.
 */

export function useSocket(projectId: string, boardId?: string): React.RefObject<AppSocket | null> {
  const socketRef = useRef<AppSocket | null>(null);

  useEffect(() => {
    const socket = createSocket(projectId, boardId);
    socketRef.current = socket;
    socket?.connect();

    return () => {
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [projectId, boardId]);

  return socketRef;
}
