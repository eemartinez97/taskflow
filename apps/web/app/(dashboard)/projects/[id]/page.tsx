import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache, type JSX } from "react";

import type { TasksMap } from "@/lib/board/tasks-map";
import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { BoardPageClient } from "./board";
import { BoardSwitcher } from "./_components/board-switcher";
import { canAdminOrg, canMutateInOrg } from "@/lib/utils/role";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Deduped per request with React cache(): generateMetadata AND the page body
 * both resolve the same project.
 *
 * `orgId` is derived from the caller's first organization because the route
 * only carries the project id. Returns `null` when the user has no org.
 */
const getProjectContext = cache(async (projectId: string) => {
  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);
  if (!org) return null;
  const project = await trpc.projects.get({ projectId, orgId: org.id });
  const role = org.memberships[0]?.role ?? "VIEWER";
  const canManage = canAdminOrg(role);
  // VIEWER can now reach this page (projects.get/boards.*/tasks.* are all
  // read-only for VIEWER too - see the routers' readerProcedure) but can't
  // create/edit/delete anything - the Kanban board and task panel use this
  // to hide/disable every write control instead of rendering enabled
  // buttons that would just bounce off the server's own roleGuard.
  const canEdit = canMutateInOrg(role);
  return { project, canManage, canEdit };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const ctx = await getProjectContext(id);
    return { title: ctx?.project.name ?? "Project" };
  } catch {
    return { title: "Project" };
  }
}

/**
 * Project board page - Server Component.
 *
 * Prefetches project, board, columns, and tasks on the server.
 * Hands off to `BoardPageClient` for the interactive Kanban board.
 */
export default async function ProjectBoardPage({
  params,
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const { id: projectId } = await params;
  const sp = await searchParams;
  const requestedBoardId = typeof sp.board === "string" ? sp.board : null;

  const trpc = await getServerTRPC();

  // Load project - notFound() if missing, unauthorized, or user has no org.
  const ctx = await getProjectContext(projectId).catch(() => null);
  if (!ctx) notFound();
  const { project, canManage, canEdit } = ctx;

  // All boards for the switcher; pick the active one (?board= or the first).
  const boards = await trpc.boards.list({ orgId: project.orgId, projectId });

  if (boards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-gray-500">No board found for this project.</p>
      </div>
    );
  }

  const firstBoard = boards[0];
  /* v8 ignore next -- structurally guaranteed: boards.length > 0 was checked above */
  if (!firstBoard) notFound();

  const activeBoardId = boards.find((b) => b.id === requestedBoardId)?.id ?? firstBoard.id;
  const board = await trpc.boards.get({ orgId: project.orgId, boardId: activeBoardId });

  if (!board) notFound();

  // Prefetch tasks per column in parallel
  const taskResults = await Promise.all(
    board.columns.map(async (col) => {
      const tasks = await trpc.tasks.list({ orgId: project.orgId, columnId: col.id });
      return [col.id, tasks] as const;
    }),
  );

  const initialTasks: TasksMap = Object.fromEntries(taskResults);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
        <BoardSwitcher
          orgId={project.orgId}
          canManage={canManage}
          projectId={projectId}
          activeBoardId={board.id}
          initialBoards={boards}
        />
      </div>
      <BoardPageClient
        orgId={project.orgId}
        projectId={projectId}
        boardId={board.id}
        initialBoard={board}
        initialTasks={initialTasks}
        canEdit={canEdit}
      />
    </div>
  );
}
