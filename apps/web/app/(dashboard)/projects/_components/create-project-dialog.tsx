"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button, Dialog, Input, Label } from "@taskflow/ui";
import { createProjectSchema } from "@taskflow/shared";

import { api } from "@/lib/trpc/client";

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
  const [serverError, setServerError] = useState<string | null>(null);

  const mutation = api.projects.create.useMutation({
    onSuccess: () => {
      void utils.projects.list.invalidate();
      onCreated();
      onClose();
    },
    onError: (err) => {
      setServerError(err.message);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
  });

  function handleClose(): void {
    reset();
    setServerError(null);
    onClose();
  }

  function onSubmit(data: FormInput): void {
    setServerError(null);
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
        {serverError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name" required>
            Name
          </Label>
          <Input id="name" hasError={!!errors.name} {...register("name")} />
          {errors.name && (
            <p className="text-xs text-red-600" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="key" required>
            Key
          </Label>
          <Input id="key" placeholder="e.g. PROJ" hasError={!!errors.key} {...register("key")} />
          {errors.key && (
            <p className="text-xs text-red-600" role="alert">
              {errors.key.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug" required>
            Slug
          </Label>
          <Input
            id="slug"
            placeholder="e.g. my-project"
            hasError={!!errors.slug}
            {...register("slug")}
          />
          {errors.slug && (
            <p className="text-xs text-red-600" role="alert">
              {errors.slug.message}
            </p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
