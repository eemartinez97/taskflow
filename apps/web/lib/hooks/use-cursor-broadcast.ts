"use client";

import { useCallback, useRef, type RefObject } from "react";
import { SOCKET_EVENTS } from "@taskflow/shared";
import type { AppSocket } from "@/lib/socket/client";

/** ~20fps: one packet every 50ms. The server rate-limits to 30/s per room. */
const CURSOR_THROTTLE_MS = 50;

export interface CursorBroadcastHandlers {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  /** Tells peers to hide this user's cursor immediately - attach to
   * onPointerLeave of the tracked board container. */
  onPointerLeave: () => void;
}

/**
 * Broadcasts the local pointer position to the project room via PRESENCE_CURSOR.
 *
 * The server re-emits verbatim, so the client MUST include its own userId.
 */
export function useCursorBroadcast(
  socketRef: RefObject<AppSocket | null> | null,
  userId: string,
): CursorBroadcastHandlers {
  const lastSentRef = useRef(0);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const socket = socketRef?.current;
      const now = Date.now();
      if (!socket || userId.length === 0 || now - lastSentRef.current < CURSOR_THROTTLE_MS) return;
      lastSentRef.current = now;

      const boardEl = e.currentTarget;
      const rect = boardEl.getBoundingClientRect();
      socket.emit(SOCKET_EVENTS.PRESENCE_CURSOR, {
        userId,
        x: e.clientX - rect.left + boardEl.scrollLeft,
        y: e.clientY - rect.top + boardEl.scrollTop,
      });
    },
    [socketRef, userId],
  );

  const onPointerLeave = useCallback(() => {
    socketRef?.current?.emit(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE);
  }, [socketRef]);

  return { onPointerMove, onPointerLeave };
}
