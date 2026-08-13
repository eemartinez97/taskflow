"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@taskflow/ui";
import { HEX_COLOR_REGEX } from "@taskflow/shared";
import type { Label } from "@taskflow/database";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";

interface LabelManagerProps {
  orgId: string;
  initialLabels: Label[];
  /** labels.create/delete are admin-only (labels.list is member-readable) - hides the mutation UI for a plain MEMBER instead of letting it fail server-side. */
  canManage: boolean;
}

const PRESET_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
] as const;

export function LabelManager({ orgId, initialLabels, canManage }: LabelManagerProps): JSX.Element {
  const utils = api.useUtils();
  const deleteDialog = useDisclosure();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [deleteTarget, setDeleteTarget] = useState<Label | null>(null);

  const { data: labels } = api.labels.list.useQuery({ orgId }, { initialData: initialLabels });

  const createMutation = api.labels.create.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: (created) => {
      toast.success(`Label "${created.name}" created.`);
      void utils.labels.list.invalidate({ orgId });
      setName("");
    },
  });

  const deleteMutation = api.labels.delete.useMutation({
    onSuccess: () => {
      void utils.labels.list.invalidate({ orgId });
      setDeleteTarget(null);
      deleteDialog.close();
    },
  });

  function handleCreate(): void {
    const trimmed = name.trim();
    /* v8 ignore next */
    if (!trimmed || !HEX_COLOR_REGEX.test(color)) return;
    createMutation.mutate({ orgId, data: { name: trimmed, color } });
  }

  function handleDeleteClick(label: Label): void {
    setDeleteTarget(label);
    deleteDialog.open();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Labels</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Existing labels */}

          <div className="flex flex-wrap gap-2">
            {labels.length === 0 && <p className="text-xs text-gray-400">No labels yet.</p>}

            {labels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
                           text-xs font-medium text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete label ${label.name}`}
                    onClick={() => {
                      handleDeleteClick(label);
                    }}
                    className="h-4 w-4 p-0 text-white hover:bg-white/20 hover:text-white"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </span>
            ))}
          </div>

          {/* Create new label */}
          {canManage && (
            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Create label
              </p>

              <Alert message={createMutation.isError ? createMutation.error.message : null} />

              <FormField label="Label name" htmlFor="label-name">
                <Input
                  id="label-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  placeholder="e.g. Bug"
                  maxLength={50}
                  className="max-w-[180px]"
                />
              </FormField>

              {/* Color preset picker */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-700">Color</span>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <Button
                      key={c}
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={`Select color ${c}`}
                      aria-pressed={color === c}
                      onClick={() => {
                        setColor(c);
                      }}
                      className="h-6 w-6 rounded-full p-0 transition-transform hover:scale-110 hover:bg-transparent"
                      style={{
                        backgroundColor: c,
                        // Show ring when selected
                        outline:
                          color === c ? "2px solid rgb(59 130 246)" : "2px solid transparent",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!name.trim()}
                className="self-start"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/*
        ConfirmDialog consumes deleteTarget (the label id) and calls
        deleteMutation.mutate() on confirm - this is why both were needed.
      */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onClose={() => {
          setDeleteTarget(null);
          deleteDialog.close();
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ orgId, labelId: deleteTarget.id });
          }
        }}
        title="Delete label"
        description={`Delete label "${deleteTarget?.name ?? ""}"? It will be removed from all tasks that use it.`}
        confirmLabel="Delete label"
        loading={deleteMutation.isPending}
        danger
      />
    </>
  );
}
