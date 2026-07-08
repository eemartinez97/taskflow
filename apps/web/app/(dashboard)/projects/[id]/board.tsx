"use client";

import type { JSX } from "react";

import type { Column } from "@taskflow/database";

import { useBoardRealtime } from "@/lib/hooks/use-board-realtime";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import type { TasksMap } from "@/hooks/use-board-dnd";
import { api } from "@/lib/trpc/client";

interface BoardPageClientProps {
  orgId: string;
  projectId: string;
  boardId: string;
  initialColumns: Column[];
  initialTasks: TasksMap;
}

/**
 * Client shell for the project board page.
 *
 * Responsibilities:
 * 1. Fetches live tasks per column (batched via httpBatchLink).
 * 2. Establishes a Socket.IO subscription via `useBoardRealtime`
 *    so incoming events update the TanStack Query cache transparently.
 * 3. Passes the merged task map to `KanbanBoard` for DnD interaction.
 */

export function BoardPageClient({
  orgId,
  projectId,
  boardId: _boardId,
  initialColumns,
  initialTasks,
}: BoardPageClientProps): JSX.Element {
  // 1. Real-time: connect Socket.IO and wire cache-update handlers
  useBoardRealtime({ orgId, projectId, columns: initialColumns });

  // 2. Fetch live tasks per column (one batch per request)
  const columnQueries = api.useQueries((t) =>
    initialColumns.map((col) =>
      t.tasks.list(
        {
          orgId,
          columnId: col.id,
        },
        {
          initialData: initialTasks[col.id] ?? [],
        },
      ),
    ),
  );

  // 3. Merge query results into a TasksMap
  const liveTasks: TasksMap = Object.fromEntries(
    initialColumns.map((col, i) => [col.id, columnQueries[i]?.data ?? initialTasks[col.id] ?? []]),
  );

  return (
    <KanbanBoard
      orgId={orgId}
      projectId={projectId}
      columns={initialColumns}
      initialTasks={liveTasks}
    />
  );
}
