"use client";

import { type JSX, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { Board } from "@taskflow/database";
import { Button, Select } from "@taskflow/ui";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { CreateBoardDialog } from "./create-board-dialog";

interface BoardSwitcherProps {
  orgId: string;
  projectId: string;
  activeBoardId: string;
  initialBoards: Board[];
  /** Only OWNER/ADMIN may delete a board; the server enforces it too. */
  canManage: boolean;
}

/**
 * Board selector for a project.
 *
 * The Select is ALWAYS rendered (even with a single board) so the active board
 * is visible and switchable. "New board" opens the create dialog; the delete
 * control appears only for managers and only when more than one board exists
 * (a project must keep at least one). Controls are `shrink-0` so the button
 * never wraps onto a second line.
 */
export function BoardSwitcher({
  orgId,
  projectId,
  activeBoardId,
  initialBoards,
  canManage,
}: BoardSwitcherProps): JSX.Element {
  const router = useAppRouter();
  const utils = api.useUtils();
  const createDialog = useDisclosure();
  const deleteDialog = useDisclosure();
  const [pendingDeleteName, setPendingDeleteName] = useState("");

  const { data: boards } = api.boards.list.useQuery(
    { orgId, projectId },
    { initialData: initialBoards },
  );

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? null;
  const canDelete = canManage && boards.length > 1;

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
    <div className="flex items-center gap-2">
      <Select
        aria-label="Select board"
        value={activeBoardId}
        onChange={(e) => {
          router.push(`/projects/${projectId}?board=${e.target.value}`);
        }}
        className="h-9 text-xs w-48 shrink-0"
      >
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>

      <Button
        size="sm"
        variant="secondary"
        onClick={createDialog.open}
        aria-label="Create board"
        className="h-9 text-xs shrink-0 whitespace-nowrap"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        New board
      </Button>

      {canDelete && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete current board"
          onClick={() => {
            setPendingDeleteName(activeBoard?.name ?? "");
            deleteDialog.open();
          }}
          className="shrink-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
