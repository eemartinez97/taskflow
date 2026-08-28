"use client";

import { useMemo, type JSX } from "react";

import type { Board, BoardWithColumns, Label } from "@taskflow/database";

import { useBoardRealtime } from "@/lib/hooks/use-board-realtime";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import type { TasksMap } from "@/lib/board/tasks-map";
import { api } from "@/lib/trpc/client";
import { usePresence } from "@/lib/hooks/use-presence";
import { SocketProvider } from "@/lib/socket/socket-context";
import { useCursors } from "@/lib/hooks/use-cursors";

interface BoardPageClientProps {
  orgId: string;
  projectId: string;
  boardId: string;
  projectName: string;
  initialBoard: BoardWithColumns;
  /** Every board in the project - powers the board switcher menu. */
  initialBoards: Board[];
  initialTasks: TasksMap;
  /** False for VIEWER - KanbanBoard hides/disables every write control. */
  canEdit: boolean;
  /** Only OWNER/ADMIN may create/delete boards; the server enforces it too. */
  canManageBoards: boolean;
}

/**
 * Client shell for the project board page.
 *
 * 1. Subscribes to boards.getByProject (initialData from the RSC prefetch) so
 *    the board name and columns are LIVE - rename/addColumn/reorderColumns
 *    invalidations now actually update the UI (previously they were no-ops:
 *    no active query observer existed for that key).
 * 2. Fetches live tasks per column (batched via httpBatchLink).
 * 3. Socket.IO subscription via useBoardRealtime.
 * 4. Builds the taskId -> labels map for card chips + board filter.
 */
export function BoardPageClient({
  orgId,
  projectId,
  boardId,
  projectName,
  initialBoard,
  initialBoards,
  initialTasks,
  canEdit,
  canManageBoards,
}: BoardPageClientProps): JSX.Element {
  // 1. Real-time: connect Socket.IO and wire cache-update handlers
  const { data } = api.boards.get.useQuery({ orgId, boardId }, { initialData: initialBoard });
  // `boards.get` resolves to `BoardWithColumns | null`; the `initialData` prop
  // guarantees a non-null value at runtime, so fall back to it for the type.
  const board = data ?? initialBoard;
  const columns = board.columns;
  const socketRef = useBoardRealtime({ orgId, projectId, boardId, columns });

  const presence = usePresence(socketRef);

  // Cursors MUST be subscribed here (same component, AFTER useBoardRealtime) so
  // socketRef.current is already populated. Inside KanbanBoard (a child) the
  // subscription effect runs BEFORE this parent's socket effect -> ref is null
  // -> it never subscribes. Same rule usePresence documents.
  const cursors = useCursors(socketRef);

  // 2. Fetch live tasks per column (one batch per request)
  const columnQueries = api.useQueries((t) =>
    columns.map((col) =>
      t.tasks.list({ orgId, columnId: col.id }, { initialData: initialTasks[col.id] ?? [] }),
    ),
  );

  // 3. Merge query results into a TasksMap
  const liveTasks: TasksMap = Object.fromEntries(
    columns.map((col, i) => [col.id, columnQueries[i]?.data ?? initialTasks[col.id] ?? []]),
  );

  // 4. taskId -> labels, for kanban card chips and the label filter
  const { data: labelPairs = [] } = api.tasks.labelsByProject.useQuery({ orgId, projectId });
  const labelsByTask = useMemo(() => {
    const map: Record<string, Label[]> = {};
    for (const { taskId, label } of labelPairs) {
      (map[taskId] ??= []).push(label);
    }
    return map;
  }, [labelPairs]);

  return (
    <SocketProvider socketRef={socketRef}>
      <KanbanBoard
        orgId={orgId}
        projectId={projectId}
        boardId={board.id}
        boardName={board.name}
        projectName={projectName}
        initialBoards={initialBoards}
        columns={columns}
        initialTasks={liveTasks}
        labelsByTask={labelsByTask}
        presence={presence}
        cursors={cursors}
        canEdit={canEdit}
        canManageBoards={canManageBoards}
      />
    </SocketProvider>
  );
}
