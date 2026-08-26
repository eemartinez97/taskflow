"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMemo, useRef, useState, type JSX } from "react";

import type { Column, Label, Task } from "@taskflow/database";
import type { SocketPresenceUser } from "@taskflow/shared";

import { findColumnIdForTask, findTaskInMap, type TasksMap } from "@/lib/board/tasks-map";
import { upsertTask } from "@/lib/socket/task-cache";
import { TaskDetailPanel } from "@/components/task/task-detail-panel";
import { useAssigneeLookup } from "@/lib/hooks/use-assignee-lookup";
import { useColumnDnD } from "@/lib/hooks/use-column-dnd";
import { AddColumnButton } from "./add-column-button";
import { useBoardDnD } from "@/lib/hooks/use-board-dnd";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { Button, cn, InlineEditText } from "@taskflow/ui";
import { ConfirmDialog } from "../common/confirm-dialog";
import { UserAvatar } from "../common/user-avatar";
import { useSession } from "next-auth/react";
import { useSocketRef } from "@/lib/socket/socket-context";
import { useCursorBroadcast } from "@/lib/hooks/use-cursor-broadcast";
import { Eye, EyeOff } from "lucide-react";
import { useCursorsHidden } from "@/lib/hooks/use-cursors-pref";
import { CursorPointer, shouldFlipCursorLabel, type LiveCursor } from "./kanban-cursors";
import { useElementSize } from "@/lib/hooks/use-element-size";

/**
 * Type-aware collision detection.
 *
 * When dragging a COLUMN, only other columns are valid drop targets. With
 * plain closestCenter the task cards inside a populated column also compete
 * and usually win (their centers sit closer to the pointer than the tall
 * column's own center), so `over` resolved to a TASK id and
 * onColumnDragEnd's findIndex returned -1 -> silent revert. Empty columns
 * only expose their own rect - that's why the bug looked like "can only
 * drop where there are no tasks".
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  if (args.active.data.current?.type === "column") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.data.current?.type === "column",
      ),
    });
  }

  return closestCenter(args);
};

/** Avatar color for the current user inside the board presence stack. */
const SELF_PRESENCE_COLOR = "#4F46E5"; // brand-600

interface KanbanBoardProps {
  orgId: string;
  projectId: string;
  boardId: string;
  boardName: string;
  columns: Column[];
  /** Initial tasks keyed by columnId - populated by the server prefetch */
  initialTasks: TasksMap;
  labelsByTask: Record<string, Label[]>;
  presence: SocketPresenceUser[];
  cursors: LiveCursor[];
  /** False for VIEWER - hides/disables every write control (rename, add/delete column, add task, drag-and-drop). */
  canEdit: boolean;
}

/**
 * Kanban board with cross-column drag-and-drop.
 *
 * Architecture:
 * - useBoardDnD owns all DnD state and optimistic local updates
 * - KanbanColumn renders each column's sorted tasks
 * - KanbanCard is the individual draggable task
 * - tRPC mutation commits the move to the server
 */
export function KanbanBoard({
  orgId,
  projectId,
  boardId,
  boardName,
  columns: initialColumns,
  initialTasks,
  labelsByTask,
  presence,
  cursors,
  canEdit,
}: KanbanBoardProps): JSX.Element {
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addingTaskColId, setAddingTaskColId] = useState<string | null>(null);
  const [isDraggingColumn, setIsDraggingColumn] = useState(false);
  const [deleteColumnTarget, setDeleteColumnTarget] = useState<Column | null>(null);
  const [labelFilter, setLabelFilter] = useState<string[]>([]);

  const utils = api.useUtils();

  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? "";

  // Presence rosters from the server exclude self; include the current user so
  // the viewer stack is symmetric across every connected client (owner + peers
  // all see the same count). `filter` guards against a StrictMode self-echo.
  const viewers: SocketPresenceUser[] = currentUserId
    ? [
        { userId: currentUserId, name: session?.user.name ?? null, color: SELF_PRESENCE_COLOR },
        ...presence.filter((u) => u.userId !== currentUserId),
      ]
    : presence;

  const { columns, activeColumnId, onColumnDragStart, onColumnDragEnd } = useColumnDnD({
    initialColumns,
    onColumnsReordered: (payload) => {
      reorderColumnsMutation.mutate({ orgId, payload: { boardId, ...payload } });
    },
  });

  const boardScrollRef = useRef<HTMLDivElement>(null);
  const { width: boardWidth } = useElementSize(boardScrollRef);

  // Map userId -> presence meta (color + name) so live cursors can be labeled
  // and colored per user instead of all sharing one brand dot.
  const presenceById = useMemo(() => new Map(presence.map((u) => [u.userId, u])), [presence]);

  // Single continuous coordinate plane - see use-cursor-broadcast.ts for why
  // per-column frames were reverted (they caused DOM remounts/flicker at
  // every column boundary crossing).
  const peerCursors: LiveCursor[] = useMemo(
    () => cursors.filter((c) => c.userId !== currentUserId),
    [cursors, currentUserId],
  );

  // Live cursors: same socket for listening (useCursors) and broadcasting.
  const socketRef = useSocketRef();
  const { onPointerMove, onPointerLeave } = useCursorBroadcast(socketRef, currentUserId);

  // User preference (per-org, DB-backed) to hide peers' live cursors if they distract.
  const { cursorsHidden, setCursorsHidden } = useCursorsHidden(orgId);

  const { data: orgLabels = [] } = api.labels.list.useQuery({ orgId });
  const { assigneeById } = useAssigneeLookup(orgId);

  function toggleLabelFilter(labelId: string): void {
    setLabelFilter((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId],
    );
  }

  /** OR semantics: a task is visible when it has ANY of the selected labels. */
  function visibleTasks(tasks: Task[]): Task[] {
    if (labelFilter.length === 0) return tasks;
    return tasks.filter((t) =>
      (labelsByTask[t.id] ?? []).some((label) => labelFilter.includes(label.id)),
    );
  }

  const renameMutation = api.boards.update.useMutation({
    onMutate: async ({ data }) => {
      await utils.boards.get.cancel({ orgId, boardId });
      const previous = utils.boards.get.getData({ orgId, boardId });
      utils.boards.get.setData({ orgId, boardId }, (prev) =>
        prev ? { ...prev, name: data.name ?? prev.name } : prev,
      );

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back the optimistic name; the global MutationCache shows the toast
      if (ctx?.previous !== undefined) {
        utils.boards.get.setData({ orgId, boardId }, ctx.previous);
      }
    },
    onSuccess: () => {
      toast.success("Board renamed.");
    },
    onSettled: () => {
      void utils.boards.get.invalidate({ orgId, boardId });
    },
  });

  const renameColumnMutation = api.boards.renameColumn.useMutation({
    onMutate: async ({ columnId, name }) => {
      await utils.boards.get.cancel({ orgId, boardId });
      const previous = utils.boards.get.getData({ orgId, boardId });
      utils.boards.get.setData({ orgId, boardId }, (prev) =>
        prev
          ? {
              ...prev,
              columns: prev.columns.map((c) => (c.id === columnId ? { ...c, name } : c)),
            }
          : prev,
      );

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.boards.get.setData({ orgId, boardId }, ctx.previous);
      }
    },
    onSettled: () => {
      void utils.boards.get.invalidate({ orgId, boardId });
    },
  });

  const deleteColumnMutation = api.boards.deleteColumn.useMutation({
    onSuccess: (_result, variables) => {
      toast.success("Column deleted.");
      setDeleteColumnTarget(null);
      utils.boards.get.setData({ orgId, boardId }, (prev) =>
        prev ? { ...prev, columns: prev.columns.filter((c) => c.id !== variables.columnId) } : prev,
      );
      // Tasks in the deleted column may have been in "My Tasks"
      void utils.tasks.myTasks.invalidate();
    },
  });

  const reorderColumnsMutation = api.boards.reorderColumns.useMutation({
    onSuccess: (_result, variables) => {
      utils.boards.get.setData({ orgId, boardId }, (prev) => {
        if (!prev) return prev;
        const positionById = new Map(variables.payload.columns.map((c) => [c.id, c.position]));
        return {
          ...prev,
          columns: prev.columns
            .map((c) => {
              const position = positionById.get(c.id);
              return position === undefined ? c : { ...c, position };
            })
            .sort((a, b) => a.position - b.position),
        };
      });
    },
  });

  // -- Task DnD

  const moveMutation = api.tasks.move.useMutation({
    onError: () => {
      void utils.tasks.list.invalidate();
    },
  });

  const {
    activeTaskId,
    localTasks,
    handlers: taskHandlers,
  } = useBoardDnD({
    initialTasks,
    onTaskMoved: ({ taskId, targetColumnId, newPosition }) => {
      moveMutation.mutate({
        orgId,
        projectId,
        payload: { taskId, targetColumnId, position: newPosition },
      });
    },
  });

  // -- Mutations --
  // createTaskMutation/addColumnMutation write the new row into the cache
  // directly from the mutation's own response (setData) instead of
  // invalidate()-ing and waiting on a second round trip. The server excludes
  // the acting user's own socket from the TASK_CREATED/BOARD_UPDATED
  // broadcast for exactly this reason (see socket/emit.ts's excludeUserId) -
  // this is what updates OUR OWN view in its place, landing in sync with
  // isPending flipping false instead of racing the realtime echo other
  // viewers get.
  const createTaskMutation = api.tasks.create.useMutation({
    onSuccess: (task) => {
      utils.tasks.list.setData({ orgId, columnId: task.columnId }, (prev) =>
        upsertTask(prev, task),
      );
    },
    onSettled: () => {
      setAddingTaskColId(null);
    },
  });

  const addColumnMutation = api.boards.addColumn.useMutation({
    onSuccess: (column) => {
      utils.boards.get.setData({ orgId, boardId }, (prev) =>
        prev ? { ...prev, columns: [...prev.columns, column] } : prev,
      );
    },
  });

  // -- Sensors --

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // -- Unified drag handlers --
  function isColumnDrag(e: DragStartEvent | DragEndEvent | DragOverEvent): boolean {
    return e.active.data.current?.type === "column";
  }

  function handleDragStart(e: DragStartEvent): void {
    if (isColumnDrag(e)) {
      setIsDraggingColumn(true);
      onColumnDragStart(e);
    } else {
      setIsDraggingColumn(false);
      taskHandlers.onDragStart(e);
    }
  }

  function handleDragOver(e: DragOverEvent): void {
    if (isColumnDrag(e)) return; // column hover has no intermediate state
    setOverId(e.over ? String(e.over.id) : null);
    taskHandlers.onDragOver(e);
  }

  function handleDragEnd(e: DragEndEvent): void {
    setOverId(null);
    setIsDraggingColumn(false);
    if (isColumnDrag(e)) {
      onColumnDragEnd(e);
    } else {
      taskHandlers.onDragEnd(e);
    }
  }

  // -- Active items for DragOverlay --
  const activeTask = activeTaskId ? findTaskInMap(localTasks, activeTaskId) : null;
  const activeColumn = columns.find((c) => c.id === activeColumnId) ?? null;

  const columnIds = columns.map((c) => c.id);

  const overColumnId = overId
    ? overId in localTasks
      ? overId
      : findColumnIdForTask(localTasks, overId)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Board header - click the name to rename (Enter/blur saves, Escape cancels) */}
      <div className="mb-4 flex items-center gap-2">
        <InlineEditText
          label="board name"
          value={boardName}
          maxLength={100}
          disabled={!canEdit}
          className="text-sm font-medium text-gray-500"
          onSave={(name) => {
            renameMutation.mutate({ orgId, boardId, data: { name } });
          }}
        />

        <Button
          variant="ghost"
          size="icon"
          aria-label={cursorsHidden ? "Show live cursors" : "Hide live cursors"}
          aria-pressed={cursorsHidden}
          title={cursorsHidden ? "Show live cursors" : "Hide live cursors"}
          onClick={() => {
            setCursorsHidden(!cursorsHidden);
          }}
          className={cn(
            "ml-1",
            cursorsHidden
              ? "bg-brand-50 text-brand-600 ring-1 ring-brand-200 hover:bg-brand-100 hover:text-brand-700"
              : "text-gray-400 hover:text-gray-600",
          )}
        >
          {cursorsHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>

        {viewers.length > 0 && (
          <div
            className="ml-auto flex items-center -space-x-1.5"
            aria-label="People viewing this board"
          >
            {viewers.slice(0, 5).map((user) => (
              <UserAvatar
                key={user.userId}
                user={{ name: user.name }}
                size="sm"
                color={user.color}
                className="ring-2 ring-white"
              />
            ))}
            {viewers.length > 5 && (
              <span className="ml-2 text-xs text-gray-400">+{viewers.length - 5}</span>
            )}
          </div>
        )}
      </div>

      {/* Label filter - OR semantics, click to toggle */}
      {orgLabels.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {orgLabels.map((label) => {
            const active = labelFilter.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  toggleLabelFilter(label.id);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity",
                  active ? "text-white" : "text-gray-600 opacity-60 hover:opacity-100",
                )}
                style={
                  active
                    ? { backgroundColor: label.color, borderColor: label.color }
                    : { borderColor: label.color }
                }
              >
                {label.name}
              </button>
            );
          })}

          {labelFilter.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setLabelFilter([]);
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <DndContext
        id={`board-dnd-${boardId}`}
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Outer SortableContext: columns (horizontal) */}
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div
            data-testid="kanban-board"
            ref={boardScrollRef}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            className="relative -mx-1 flex min-h-0 flex-1 overflow-x-auto rounded-lg
            border border-dashed border-gray-200 px-1 pt-1 pb-2"
            role="region"
            aria-label="Kanban board"
          >
            {/* Content wrapper: same clipping technique as the column - auto
                width driven only by in-flow columns + add-column button, so a
                peer's board-level cursor never inflates OUR horizontal
                scrollWidth when we have fewer/narrower columns than them. */}
            <div className="relative flex min-h-0 flex-1 gap-4">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={visibleTasks(localTasks[column.id] ?? [])}
                  labelsByTask={labelsByTask}
                  assigneeById={assigneeById}
                  isOver={overColumnId === column.id}
                  isColumnDragging={isDraggingColumn}
                  canEdit={canEdit}
                  onAddTask={(columnId, title) => {
                    setAddingTaskColId(columnId);
                    createTaskMutation.mutate({ orgId, projectId, data: { columnId, title } });
                  }}
                  onTaskClick={(task) => {
                    setSelectedTask(task);
                  }}
                  addingTaskId={addingTaskColId}
                  onRenameColumn={(columnId, name) => {
                    renameColumnMutation.mutate({ orgId, columnId, name });
                  }}
                  onDeleteColumn={(column) => {
                    setDeleteColumnTarget(column);
                  }}
                />
              ))}

              {canEdit && (
                <AddColumnButton
                  onAdd={(name) => {
                    addColumnMutation.mutate({ orgId, boardId, name });
                  }}
                  loading={addColumnMutation.isPending}
                  columnCount={columns.length}
                />
              )}
            </div>

            <div
              className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
              aria-hidden="true"
            >
              {!cursorsHidden &&
                peerCursors.map((c) => (
                  <CursorPointer
                    key={c.userId}
                    cursor={c}
                    meta={presenceById.get(c.userId)}
                    flip={shouldFlipCursorLabel(c.x, boardWidth)}
                  />
                ))}
            </div>
          </div>
        </SortableContext>

        {/* DragOverlay - shows ghost while dragging */}
        <DragOverlay>
          {/* v8 ignore start - Ghost overlay visual rendering is driven by pixel
              coordinates from DndContext which are not available in jsdom.
              DnD logic is tested in kanban-board-dnd.test.tsx via direct handler invocation. */}
          {activeColumn ? (
            /* Ghost column while reordering */
            <div className="flex w-72 shrink-0 flex-col gap-2 rounded-md border-2 border-brand-400 bg-white opacity-80 shadow-lg">
              <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {activeColumn.name}
                </span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                  {(localTasks[activeColumn.id] ?? []).length}
                </span>
              </div>
            </div>
          ) : activeTask ? (
            /* Ghost card while reordering tasks */
            <KanbanCard
              task={activeTask}
              isOverlay
              labels={labelsByTask[activeTask.id] ?? []}
              assignee={
                activeTask.assigneeId ? (assigneeById.get(activeTask.assigneeId) ?? null) : null
              }
            />
          ) : null}
          {/* v8 ignore stop */}
        </DragOverlay>
      </DndContext>

      {/* Delete column confirmation */}
      <ConfirmDialog
        open={!!deleteColumnTarget}
        onClose={() => {
          setDeleteColumnTarget(null);
        }}
        onConfirm={() => {
          if (deleteColumnTarget) {
            deleteColumnMutation.mutate({ orgId, columnId: deleteColumnTarget.id });
          }
        }}
        title="Delete column"
        description={`Delete "${deleteColumnTarget?.name ?? ""}"? This permanently deletes the column and its ${String((localTasks[deleteColumnTarget?.id ?? ""] ?? []).length)} task(s).`}
        confirmLabel="Delete column"
        loading={deleteColumnMutation.isPending}
        danger
      />

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          orgId={orgId}
          projectId={projectId}
          canEdit={canEdit}
          onClose={() => {
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}
