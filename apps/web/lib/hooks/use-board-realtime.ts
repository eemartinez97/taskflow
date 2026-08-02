"use client";

import { type RefObject, useEffect, useMemo } from "react";

import type { ServerToClientEvents, SocketTask } from "@taskflow/shared";
import type { Column } from "@taskflow/database";
import { SOCKET_EVENTS } from "@taskflow/shared";

import { upsertTask, removeTask, applyTaskMove } from "@/lib/socket/task-cache";
import type { AppSocket } from "../socket/client";
import { useSocket } from "./use-socket";
import { api } from "@/lib/trpc/client";

interface UseBoardRealtimeOptions {
  orgId: string;
  projectId: string;
  boardId: string;
  columns: Column[];
}

/**
 * Subscribes to all board-scoped Socket.IO events and applies
 * optimistic cache updates via tRPC's `setData`.
 *
 * Architecture:
 * - `useSocket` owns the connection lifecycle (connect / disconnect).
 * - This hook owns event subscriptions and cache mutations only.
 * - Each `setData` call targets `tasks.list` with the correct
 *   `{ orgId, columnId }` input so TanStack Query updates the right key.
 *
 * WHY setData instead of invalidate:
 * `invalidate` triggers a network round-trip.
 * `setData` applies the delta instantly with zero latency - the same
 * data was just received from the server via the socket.
 *
 * TanStack Query v5: `setData` updater receives `prev | undefined`.
 * `upsertTask` / `removeTask` handle the undefined case internally.
 *
 * NOTE: these events are only reachable now that browser mutations run
 * against apps/api (see lib/trpc/client.tsx) - the Next.js route handler
 * built the router with `noOpIo`, so nothing was ever emitted.
 */

export function useBoardRealtime({
  orgId,
  projectId,
  boardId,
  columns,
}: UseBoardRealtimeOptions): RefObject<AppSocket | null> {
  const socketRef = useSocket(projectId, boardId);
  const utils = api.useUtils();

  // Memoized IDs to keep the effect dependency array clean and stable
  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const columnIdsKey = columnIds.join(",");

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Helper to keep tRPC cache keys clean and consistent
    const getCacheKey = (columnId: string) => ({ orgId, columnId });

    // -- Handler: task:created / task:updated --
    // Appends the new task to its column cache or replaces the existing entry in-place
    const onTaskUpserted: ServerToClientEvents[typeof SOCKET_EVENTS.TASK_CREATED] = ({ task }) => {
      utils.tasks.list.setData(getCacheKey(task.columnId), (prev) => upsertTask(prev, task));
    };

    // -- Handler: task:moved --
    // Removes from source column, inserts into target column (sorted by position)
    const onTaskMoved: ServerToClientEvents[typeof SOCKET_EVENTS.TASK_MOVED] = ({ task }) => {
      // Build current snapshot from cache
      const snapshot: Record<string, SocketTask[]> = {};
      for (const colId of columnIds) {
        const cached = utils.tasks.list.getData(getCacheKey(colId));
        snapshot[colId] = cached ?? [];
      }

      const updated = applyTaskMove(snapshot, task, columnIds);

      // Write every column back into the cache. applyTaskMove always returns
      // fresh array references (removeTask uses .filter()), so writing
      // unconditionally is correct and avoids a pointless dirty-check.
      for (const colId of columnIds) {
        utils.tasks.list.setData(getCacheKey(colId), updated[colId]);
      }
    };

    // -- Handler: task:deleted --
    // Removes the task from its column (exhaustive search - column unknown from event)
    const onTaskDeleted: ServerToClientEvents[typeof SOCKET_EVENTS.TASK_DELETED] = ({ taskId }) => {
      for (const colId of columnIds) {
        utils.tasks.list.setData(getCacheKey(colId), (prev) => removeTask(prev, taskId));
      }
    };

    // -- Handler: task:labels_changed --
    // Replaces every (taskId, label) pair of that task with the fresh list
    const onTaskLabelsChanged: ServerToClientEvents[typeof SOCKET_EVENTS.TASK_LABELS_CHANGED] = ({
      taskId,
      labels,
    }) => {
      utils.tasks.labelsByProject.setData({ orgId, projectId }, (prev) => [
        ...(prev ?? []).filter((pair) => pair.taskId !== taskId),
        ...labels.map((label) => ({ taskId, label })),
      ]);
    };

    // -- Handler: board:updated --
    // Server truth for the board name + columns after ANY board/column
    // mutation by anyone. Replaces the cache wholesale - same key that
    // feeds the whole board since the live-board refactor.
    const onBoardUpdated: ServerToClientEvents[typeof SOCKET_EVENTS.BOARD_UPDATED] = ({
      board,
    }) => {
      if (board.id === boardId) {
        utils.boards.get.setData({ orgId, boardId }, board);
      }
    };

    // -- Handler: comment:created --
    const onCommentCreated: ServerToClientEvents[typeof SOCKET_EVENTS.COMMENT_CREATED] = ({
      comment,
    }) => {
      utils.comments.list.setData({ orgId, taskId: comment.taskId }, (prev) => {
        const existing = prev ?? [];
        if (existing.some((c) => c.id === comment.id)) return existing;
        return [...existing, comment];
      });
    };

    // -- Handler: comment:deleted --
    const onCommentDeleted: ServerToClientEvents[typeof SOCKET_EVENTS.COMMENT_DELETED] = ({
      commentId,
      taskId,
    }) => {
      utils.comments.list.setData({ orgId, taskId }, (prev) =>
        (prev ?? []).filter((c) => c.id !== commentId),
      );
    };

    // Map events to handlers for dynamic subscribe/unsubscribe
    const eventHandlers = [
      [SOCKET_EVENTS.TASK_CREATED, onTaskUpserted],
      [SOCKET_EVENTS.TASK_UPDATED, onTaskUpserted],
      [SOCKET_EVENTS.TASK_MOVED, onTaskMoved],
      [SOCKET_EVENTS.TASK_DELETED, onTaskDeleted],
      [SOCKET_EVENTS.COMMENT_DELETED, onCommentDeleted],
      [SOCKET_EVENTS.COMMENT_CREATED, onCommentCreated],
      [SOCKET_EVENTS.TASK_LABELS_CHANGED, onTaskLabelsChanged],
      [SOCKET_EVENTS.BOARD_UPDATED, onBoardUpdated],
    ] as const;

    for (const [event, handler] of eventHandlers) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of eventHandlers) {
        socket.off(event, handler);
      }
    };

    // columnIds is derived from columns - stable as long as columns don't change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef, utils, orgId, projectId, boardId, columnIdsKey]);
  return socketRef;
}
