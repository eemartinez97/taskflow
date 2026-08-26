"use client";

import { type JSX, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@taskflow/api/trpc";
import { Badge } from "@taskflow/ui";

import { TaskDetailPanel } from "@/components/task/task-detail-panel";
import { PRIORITY_COLORS } from "@/lib/constants/task";
import { api } from "@/lib/trpc/client";
import { canMutateInOrg } from "@/lib/utils/role";
import { formatTaskStatus } from "@/lib/utils/task";

/**
 * `tasks.myTasks` returns Task enriched with projectId/orgId (flattened
 * relation chain - see the API patch in modules/tasks/repo.ts). Inferring
 * from the router keeps this type in lockstep with the server.
 */
type MyTask = inferRouterOutputs<AppRouter>["tasks"]["myTasks"][number];

interface TasksClientProps {
  initialTasks: MyTask[];
  initialOpenTaskId: string | null;
}

export function TasksClient({ initialTasks, initialOpenTaskId }: TasksClientProps): JSX.Element {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialOpenTaskId);

  // tasks.myTasks - live subscription
  const { data: tasks } = api.tasks.myTasks.useQuery(undefined, {
    initialData: initialTasks,
  });

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  // "My Tasks" spans every org the caller belongs to, each with its own
  // role - unlike the single-org board page, there's no one `canEdit` to
  // compute up front. A task can still be assigned to someone who's since
  // been demoted to VIEWER in that specific org (same "stale attribution"
  // idea as an ex-member assignee elsewhere in the app), so this looks up
  // the role for the SELECTED task's own org rather than assuming MEMBER+.
  const { data: orgs } = api.orgs.list.useQuery();
  const selectedTaskOrgRole = orgs?.find((o) => o.id === selectedTask?.orgId)?.memberships[0]?.role;
  const canEditSelectedTask = canMutateInOrg(selectedTaskOrgRole ?? "VIEWER");

  return (
    <>
      <section aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" className="mb-4 text-lg font-semibold text-gray-900">
          My Tasks
        </h2>

        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tasks assigned to you yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {tasks.map((task) => (
              <li
                key={task.id}
                onClick={() => {
                  setSelectedTaskId(task.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedTaskId(task.id);
                }}
                aria-label={`Open task: ${task.title}`}
                className="flex cursor-pointer items-center justify-between px-4 py-3
                           hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate">{task.title}</span>
                  {task.description && (
                    <span className="text-xs text-gray-400 line-clamp-1">{task.description}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Badge variant={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                  {/* replaceAll: .replace only touched the FIRST underscore */}
                  <span className="text-xs text-gray-400">
                    {formatTaskStatus(task.status)}
                  </span>{" "}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          orgId={selectedTask.orgId}
          projectId={selectedTask.projectId}
          canEdit={canEditSelectedTask}
          onClose={() => {
            setSelectedTaskId(null);
          }}
        />
      )}
    </>
  );
}
