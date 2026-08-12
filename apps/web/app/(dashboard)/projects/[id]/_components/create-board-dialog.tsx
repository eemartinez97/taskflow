"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type JSX } from "react";
import { useForm } from "react-hook-form";
import { createBoardSchema, type CreateBoard } from "@taskflow/shared";
import { Alert, Button, Dialog, FormField, Input } from "@taskflow/ui";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { createDialogCloseHandler } from "@/lib/utils/form";

interface CreateBoardDialogProps {
  orgId: string;
  projectId: string;
  open: boolean;
  onClose: () => void;
}

/** Creates an additional board within a project (multi-board feature). */
export function CreateBoardDialog({
  orgId,
  projectId,
  open,
  onClose,
}: CreateBoardDialogProps): JSX.Element {
  const utils = api.useUtils();
  const router = useAppRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateBoard>({
    resolver: zodResolver(createBoardSchema),
    defaultValues: { projectId, name: "" },
  });

  const mutation = api.boards.create.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: (board) => {
      toast.success("Board created.");
      void utils.boards.list.invalidate({ orgId, projectId });
      reset({ projectId, name: "" });
      onClose();
      // Deep-link to the new board so it becomes the active one.
      router.push(`/projects/${projectId}?board=${board.id}`);
    },
  });

  const handleClose = createDialogCloseHandler(reset, mutation, onClose, {
    projectId,
    name: "",
  });

  function onSubmit(data: CreateBoard): void {
    mutation.mutate({ orgId, data });
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose}>
        Cancel
      </Button>
      <Button type="submit" form="create-board-form" loading={isSubmitting || mutation.isPending}>
        Create
      </Button>
    </>
  );

  return (
    <Dialog open={open} onClose={handleClose} title="Create board" footer={footer}>
      <form
        id="create-board-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Alert message={mutation.isError ? mutation.error.message : null} />
        <FormField label="Name" htmlFor="cb-name" required error={errors.name?.message}>
          <Input
            id="cb-name"
            placeholder="e.g. Sprint 2"
            hasError={!!errors.name}
            {...register("name")}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
