"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { SOCKET_EVENTS, type ServerToClientEvents } from "@taskflow/shared";
import type { AppSocket } from "@/lib/socket/client";

/** Cursor payload as defined by the server contract (presenceCursorSchema). */
type CursorPayload = Parameters<ServerToClientEvents[typeof SOCKET_EVENTS.PRESENCE_CURSOR]>[0];

/**
 * A cursor is dropped this long after its last packet. The server never emits
 * a "cursor:leave" event, so without a TTL an idle user's dot stays pinned
 * forever. Mirrors the 3s typing-timeout pattern in task-comments.tsx.
 */
const CURSOR_TTL_MS = 3_000;

/**
 * Live cursors of other users on the same board.
 * Subscribes to PRESENCE_CURSOR, which the API already validates,
 * rate-limits and re-broadcasts per project room. Nothing consumed it before.
 *
 * Keyed by userId so each user has at most one cursor. Must be called in the
 * same component subtree as the SocketProvider so the ref is populated.
 *
 * Each incoming packet refreshes a per-user expiry timer; a cursor that stops
 * updating for CURSOR_TTL_MS is removed so stale dots fade out on their own.
 */

export function useCursors(socketRef: RefObject<AppSocket | null> | null): CursorPayload[] {
  const [cursors, setCursors] = useState<Map<string, CursorPayload>>(new Map());
  /** Per-user expiry timers. Kept in a ref so re-renders don't reset them. */
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const timers = timersRef.current;

    const dropCursor = (userId: string): void => {
      setCursors((prev) => {
        if (!prev.has(userId)) return prev;
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
      clearTimeout(timers.get(userId));
      timers.delete(userId);
    };

    const onCursor: ServerToClientEvents[typeof SOCKET_EVENTS.PRESENCE_CURSOR] = (payload) => {
      setCursors((prev) => new Map(prev).set(payload.userId, payload));
      // Refresh this user's expiry timer on every packet.
      clearTimeout(timers.get(payload.userId));
      timers.set(
        payload.userId,
        setTimeout(() => {
          dropCursor(payload.userId);
        }, CURSOR_TTL_MS),
      );
    };

    // Explicit leave: dropped INSTANTLY instead of waiting out the idle TTL -
    // e.g. when a peer's pointer exits the tracked board area entirely.
    const onCursorLeave: ServerToClientEvents[typeof SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE] = ({
      userId,
    }) => {
      dropCursor(userId);
    };

    socket.on(SOCKET_EVENTS.PRESENCE_CURSOR, onCursor);
    socket.on(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE, onCursorLeave);

    return () => {
      socket.off(SOCKET_EVENTS.PRESENCE_CURSOR, onCursor);
      socket.off(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE, onCursorLeave);
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      setCursors(new Map());
    };
  }, [socketRef]);

  return [...cursors.values()];
}
