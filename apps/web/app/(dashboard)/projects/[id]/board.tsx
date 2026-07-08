"use client";

import type { JSX } from "react";

import type { Column } from "@taskflow/database";

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
 * Fetches tasks per column (batched into one HTTP request by tRPC's httpBatchLink).
 * Passes the merged task map down to KanbanBoard which manages DnD state.
 */

export function BoardPageClient({
  orgId,
  projectId,
  boardId: _boardId,
  initialColumns,
  initialTasks,
}: BoardPageClientProps): JSX.Element {
  // Fetch live tasks per column - httpBatchLink sends all requests in one HTTP call
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

  // Merge query results into a TasksMap
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
