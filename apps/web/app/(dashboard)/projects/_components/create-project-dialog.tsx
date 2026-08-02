"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type JSX } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Alert, Button, Dialog, FormField, Input } from "@taskflow/ui";
import { createProjectSchema } from "@taskflow/shared";

import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { deriveProjectKey, deriveSlug } from "@/lib/utils/derive";
import { createDialogCloseHandler } from "@/lib/utils/form";
import { createDerivedFieldHandler } from "@/lib/hooks/use-derived-field";

/** Web-app form schema: CreateProject + orgId context */
const formSchema = createProjectSchema;

type FormInput = z.infer<typeof formSchema>;

interface CreateProjectDialogProps {
  orgId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProjectDialog({
  orgId,
  open,
  onClose,
  onCreated,
}: CreateProjectDialogProps): JSX.Element {
  const utils = api.useUtils();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
  });

  const mutation = api.projects.create.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: () => {
      toast.success("Project created.");
      void utils.projects.list.invalidate();
      reset();
      onCreated();
      onClose();
    },
  });

  const handleClose = createDialogCloseHandler(reset, mutation, onClose);

  function onSubmit(data: FormInput): void {
    mutation.mutate({
      orgId,
      data: { name: data.name, key: data.key, slug: data.slug },
    });
  }

  const dialogFooter = (
    <>
      <Button type="button" variant="secondary" onClick={handleClose}>
        Cancel
      </Button>
      <Button type="submit" form="create-project-form" loading={isSubmitting || mutation.isPending}>
        Create
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Create Project"
      description="Projects group related boards and tasks."
      footer={dialogFooter}
    >
      <form
        id="create-project-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Alert message={mutation.isError ? mutation.error.message : null} />

        <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
          <Input
            id="name"
            hasError={!!errors.name}
            {...register("name", {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                // Auto-derive both fields until the user edits them directly
                // (setValue does NOT mark fields dirty; user typing does).
                createDerivedFieldHandler(
                  setValue,
                  dirtyFields.key ?? false,
                  "key",
                  deriveProjectKey,
                )(e);
                createDerivedFieldHandler(
                  setValue,
                  dirtyFields.slug ?? false,
                  "slug",
                  deriveSlug,
                )(e);
              },
            })}
          />
        </FormField>

        <FormField label="Key" htmlFor="key" required error={errors.key?.message}>
          <Input id="key" placeholder="e.g. PROJ" hasError={!!errors.key} {...register("key")} />
        </FormField>

        <FormField label="Slug" htmlFor="slug" required error={errors.slug?.message}>
          <Input
            id="slug"
            placeholder="e.g. my-project"
            hasError={!!errors.slug}
            {...register("slug")}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
