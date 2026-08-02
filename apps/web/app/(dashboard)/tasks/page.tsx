import type { Metadata } from "next";
import type { JSX } from "react";

import { NoOrgState } from "@/components/common/no-org-state";
import { TasksClient } from "./_components/tasks-client";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { getServerTRPC } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Tasks" };

interface TasksPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TasksPage({ searchParams }: TasksPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const openTaskId = typeof params.task === "string" ? params.task : null;

  const trpc = await getServerTRPC();
  const org = await getOrgOrNull(trpc);

  if (!org) {
    return <NoOrgState context="Tasks are assigned within projects and organizations." />;
  }

  const tasks = await trpc.tasks.myTasks();

  return <TasksClient initialTasks={tasks} initialOpenTaskId={openTaskId} />;
}
