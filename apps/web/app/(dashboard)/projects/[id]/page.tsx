import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { JSX } from "react";

import type { TasksMap } from "@/hooks/use-board-dnd";
import { getServerTRPC } from "@/lib/trpc/server";
import { BoardPageClient } from "./board";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const trpc = await getServerTRPC();
    const project = await trpc.projects.get({ projectId: id });
    return { title: project.name };
  } catch {
    return { title: "Project" };
  }
}

/**
 * Project board page — Server Component.
 *
 * Prefetches project, board, columns, and tasks on the server.
 * Hands off to `BoardPageClient` for interactive Kanban board.
 */
export default async function ProjectBoardPage({ params }: PageProps): Promise<JSX.Element> {
  const { id: projectId } = await params;

  const trpc = await getServerTRPC();

  // Load project - redirects to notFound() if missing or unauthorized
  let project;
  try {
    project = await trpc.projects.get({ projectId });
  } catch {
    notFound();
  }

  const board = await trpc.boards.getByProject({ orgId: project.orgId, projectId });

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-gray-500">No board found for this project.</p>
      </div>
    );
  }

  // Prefetch tasks per column in parallel
  const columns = board.columns;
  const taskResults = await Promise.all(
    columns.map(async (col) => {
      const tasks = await trpc.tasks.list({ orgId: project.orgId, columnId: col.id });
      return [col.id, tasks] as const;
    }),
  );

  const initialTasks: TasksMap = Object.fromEntries(taskResults);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
        <p className="text-sm text-gray-500">{board.name}</p>
      </div>

      <BoardPageClient
        orgId={project.orgId}
        projectId={projectId}
        boardId={board.id}
        initialColumns={columns}
        initialTasks={initialTasks}
      />
    </div>
  );
}
