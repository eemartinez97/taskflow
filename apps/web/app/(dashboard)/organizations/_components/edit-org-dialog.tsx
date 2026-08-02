"use client";

import { useEffect, type JSX } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { Org } from "@taskflow/database";
import { updateOrgSchema, type UpdateOrg } from "@taskflow/shared";
import { Alert, Button, Dialog, FormField, Input } from "@taskflow/ui";

import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { createDialogCloseHandler } from "@/lib/utils/form";

interface EditOrgDialogProps {
  org: Org;
  open: boolean;
  onClose: () => void;
}

export function EditOrgDialog({ org, open, onClose }: EditOrgDialogProps): JSX.Element {
  const utils = api.useUtils();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateOrg>({
    resolver: zodResolver(updateOrgSchema),
    defaultValues: { name: org.name, slug: org.slug },
  });

  useEffect(() => {
    if (open) reset({ name: org.name, slug: org.slug });
  }, [open, org, reset]);

  const mutation = api.orgs.update.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: () => {
      toast.success("Organization updated.");
      void utils.orgs.list.invalidate();
      onClose();
    },
  });

  const handleClose = createDialogCloseHandler(reset, mutation, onClose, {
    name: org.name,
    slug: org.slug,
  });

  function onSubmit(data: UpdateOrg): void {
    mutation.mutate({ orgId: org.id, data });
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose}>
        Cancel
      </Button>
      <Button type="submit" form="edit-org-form" loading={isSubmitting || mutation.isPending}>
        Save
      </Button>
    </>
  );

  return (
    <Dialog open={open} onClose={handleClose} title="Edit organization" footer={footer}>
      <form
        id="edit-org-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Alert message={mutation.isError ? mutation.error.message : null} />
        <FormField label="Name" htmlFor="eo-name" required error={errors.name?.message}>
          <Input id="eo-name" hasError={!!errors.name} {...register("name")} />
        </FormField>
        <FormField label="Slug" htmlFor="eo-slug" required error={errors.slug?.message}>
          <Input id="eo-slug" hasError={!!errors.slug} {...register("slug")} />
        </FormField>
      </form>
    </Dialog>
  );
}
