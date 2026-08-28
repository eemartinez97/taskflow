"use client";

import { type JSX, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";

import type { Board } from "@taskflow/database";
import { Button, cn } from "@taskflow/ui";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { useEscapeKey } from "@/lib/hooks/use-escape-key";
import { useOutsideClick } from "@/lib/hooks/use-outside-click";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { CreateBoardDialog } from "./create-board-dialog";

interface BoardSwitcherProps {
  orgId: string;
  projectId: string;
  activeBoardId: string;
  initialBoards: Board[];
  /** MEMBER and above may create a board (server: boards.create = memberProcedure); VIEWER may not. */
  canCreate: boolean;
  /** Only OWNER/ADMIN may delete a board; the server enforces it too. */
  canManage: boolean;
}

/**
 * Board switcher for a project - a single chevron-triggered popover
 * (list of boards, "New board", "Delete board") instead of three
 * always-visible controls (a <Select>, a "New board" button, a delete
 * icon). The active board's NAME is rendered and renamed separately, right
 * next to this trigger (see kanban-board.tsx's InlineEditText) - this
 * component only ever switches/creates/deletes, never edits the current
 * board's name, so a click here never collides with a click-to-rename.
 *
 * Closes on outside-click and Escape, same convention as DropdownMenu.
 */
export function BoardSwitcher({
  orgId,
  projectId,
  activeBoardId,
  initialBoards,
  canCreate,
  canManage,
}: BoardSwitcherProps): JSX.Element {
  const router = useAppRouter();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const createDialog = useDisclosure();
  const deleteDialog = useDisclosure();
  const [pendingDeleteName, setPendingDeleteName] = useState("");

  const { data: boards } = api.boards.list.useQuery(
    { orgId, projectId },
    { initialData: initialBoards },
  );

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? null;
  const canDelete = canManage && boards.length > 1;

  useOutsideClick(containerRef, open, () => {
    setOpen(false);
  });

  useEscapeKey(open, () => {
    setOpen(false);
  });

  const deleteMutation = api.boards.delete.useMutation({
    onSuccess: () => {
      toast.success("Board deleted.");
      void utils.boards.list.invalidate({ orgId, projectId });
      deleteDialog.close();
      // Navigate to the first remaining board.
      const next = boards.find((b) => b.id !== activeBoardId);
      router.push(next ? `/projects/${projectId}?board=${next.id}` : `/projects/${projectId}`);
      router.refresh();
    },
  });

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Switch board"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((p) => !p);
        }}
        className="text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-1 min-w-[220px] rounded-lg border border-gray-200
                     bg-white py-1 shadow-lg"
        >
          <div className="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            Boards
          </div>

          {boards.map((board) => {
            const active = board.id === activeBoardId;
            return (
              <button
                key={board.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (!active) router.push(`/projects/${projectId}?board=${board.id}`);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm",
                  active
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-gray-700 hover:bg-gray-50",
                )}
              >
                {board.name}
                {active && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}

          {canCreate && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  createDialog.open();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium
                           text-brand-600 hover:bg-brand-50"
              >
                <Plus className="h-3.5 w-3.5" />
                New board
              </button>
            </>
          )}

          {canDelete && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setPendingDeleteName(activeBoard?.name ?? "");
                  deleteDialog.open();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium
                           text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete current board
              </button>
            </>
          )}
        </div>
      )}

      <CreateBoardDialog
        orgId={orgId}
        projectId={projectId}
        open={createDialog.isOpen}
        onClose={createDialog.close}
      />

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        onConfirm={() => {
          deleteMutation.mutate({ orgId, boardId: activeBoardId });
        }}
        title="Delete board"
        description={`Delete "${pendingDeleteName}"? This permanently removes the board, its columns and all their tasks.`}
        confirmText={pendingDeleteName}
        confirmLabel="Delete board"
        loading={deleteMutation.isPending}
        danger
      />
    </div>
  );
}
