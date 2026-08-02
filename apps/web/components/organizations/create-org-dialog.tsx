"use client";

import { type JSX } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createOrgSchema, type CreateOrg } from "@taskflow/shared";
import { Alert, Button, Dialog, FormField, Input } from "@taskflow/ui";

import { api } from "@/lib/trpc/client";
import { deriveSlug } from "@/lib/utils/derive";
import { createDialogCloseHandler } from "@/lib/utils/form";
import { createDerivedFieldHandler } from "@/lib/hooks/use-derived-field";

interface CreateOrgDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new org's id right before the dialog closes. */
  onCreated: (orgId: string) => void;
}

/**
 * Modal organization creation form.
 *
 * Single source of truth for "create an org" everywhere EXCEPT the true
 * first-run bootstrap (/onboarding, reached only when the user has zero
 * orgs and there's nowhere meaningful to cancel back to). Used by the
 * sidebar OrgSwitcher and the Organizations management page.
 */
export function CreateOrgDialog({ open, onClose, onCreated }: CreateOrgDialogProps): JSX.Element {
  const utils = api.useUtils();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<CreateOrg>({ resolver: zodResolver(createOrgSchema) });

  const mutation = api.orgs.create.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: (org) => {
      void utils.orgs.list.invalidate();
      reset();
      onCreated(org.id);
    },
  });

  const handleClose = createDialogCloseHandler(reset, mutation, onClose);

  function onSubmit(data: CreateOrg): void {
    mutation.mutate(data);
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose}>
        Cancel
      </Button>
      <Button type="submit" form="create-org-form" loading={isSubmitting || mutation.isPending}>
        Create
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Create organization"
      description="An organization groups your projects and team members."
      footer={footer}
    >
      <form
        id="create-org-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Alert message={mutation.isError ? mutation.error.message : null} />

        <FormField label="Name" htmlFor="co-name" required error={errors.name?.message}>
          <Input
            id="co-name"
            placeholder="Acme Corp"
            hasError={!!errors.name}
            {...register("name", {
              onChange: createDerivedFieldHandler(
                setValue,
                dirtyFields.slug ?? false,
                "slug",
                deriveSlug,
              ),
            })}
          />
        </FormField>

        <FormField label="Slug" htmlFor="co-slug" required error={errors.slug?.message}>
          <Input
            id="co-slug"
            placeholder="acme-corp"
            hasError={!!errors.slug}
            {...register("slug")}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
