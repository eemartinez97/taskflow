"use client";

import { useEffect, type JSX } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Project } from "@taskflow/database";
import { updateProjectSchema, type UpdateProject } from "@taskflow/shared";

import { Alert, Button, Dialog, FormField, Input } from "@taskflow/ui";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { createDialogCloseHandler } from "@/lib/utils/form";

interface EditProjectDialogProps {
  project: Project;
  orgId: string;
  open: boolean;
  onClose: () => void;
}

export function EditProjectDialog({
  project,
  orgId,
  open,
  onClose,
}: EditProjectDialogProps): JSX.Element {
  const utils = api.useUtils();

  const mutation = api.projects.update.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: () => {
      toast.success("Project updated.");
      void utils.projects.list.invalidate();
      onClose();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProject>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: { name: project.name, key: project.key, slug: project.slug },
  });

  // Reset form when the dialog reopens with a different project
  useEffect(() => {
    if (open) reset({ name: project.name, key: project.key, slug: project.slug });
  }, [open, project, reset]);

  const handleClose = createDialogCloseHandler(reset, mutation, onClose);

  function onSubmit(data: UpdateProject): void {
    mutation.mutate({ orgId, projectId: project.id, data });
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose}>
        Cancel
      </Button>
      <Button type="submit" form="edit-project-form" loading={isSubmitting || mutation.isPending}>
        Save
      </Button>
    </>
  );

  return (
    <Dialog open={open} onClose={handleClose} title="Edit Project" footer={footer}>
      <form
        id="edit-project-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Alert message={mutation.isError ? mutation.error.message : null} />

        <FormField label="Name" htmlFor="ep-name" required error={errors.name?.message}>
          <Input id="ep-name" hasError={!!errors.name} {...register("name")} />
        </FormField>

        <FormField label="Key" htmlFor="ep-key" required error={errors.key?.message}>
          <Input id="ep-key" hasError={!!errors.key} {...register("key")} />
        </FormField>

        <FormField label="Slug" htmlFor="ep-slug" required error={errors.slug?.message}>
          <Input id="ep-slug" hasError={!!errors.slug} {...register("slug")} />
        </FormField>
      </form>
    </Dialog>
  );
}
