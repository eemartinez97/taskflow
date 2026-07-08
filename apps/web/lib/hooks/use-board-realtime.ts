"use client";

import { useEffect, useMemo } from "react";

import type { ServerToClientEvents, SocketTask } from "@taskflow/shared";
import type { Column } from "@taskflow/database";
import { SOCKET_EVENTS } from "@taskflow/shared";

import { upsertTask, removeTask, applyTaskMove } from "@/lib/socket/task-cache";
import { useSocket } from "./use-socket";
import { api } from "@/lib/trpc/client";

interface UseBoardRealtimeOptions {
  orgId: string;
  projectId: string;
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
 */

export function useBoardRealtime({ orgId, projectId, columns }: UseBoardRealtimeOptions): void {
  const socketRef = useSocket(projectId);
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

      // Write each affected column back into the cache
      for (const colId of columnIds) {
        // Write every column back — applyTaskMove always returns new references
        // (removeTask uses .filter(), so the optimization snapshot !== updated is
        //  always true — removing the check eliminates dead branches)
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

    // Map events to handlers for dynamic subscribe/unsubscribe
    const eventHandlers = [
      [SOCKET_EVENTS.TASK_CREATED, onTaskUpserted],
      [SOCKET_EVENTS.TASK_UPDATED, onTaskUpserted],
      [SOCKET_EVENTS.TASK_MOVED, onTaskMoved],
      [SOCKET_EVENTS.TASK_DELETED, onTaskDeleted],
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
  }, [socketRef, utils, orgId, projectId, columnIdsKey]);
}
