"use client";

import { type JSX, useId } from "react";
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
 * Single source of truth for "create an org" everywhere, including the
 * zero-org empty states (NoOrgState, OrgSwitcher) - there's no dedicated
 * first-run page, just this dialog reused wherever an org is needed.
 */
export function CreateOrgDialog({ open, onClose, onCreated }: CreateOrgDialogProps): JSX.Element {
  const utils = api.useUtils();
  // Unique per instance: this dialog is mounted more than once at a time
  // (e.g. both NoOrgState and OrgSwitcher render their own copy while the
  // user has zero orgs) - hardcoded ids here would collide across instances.
  // That breaks label-based field lookup for whichever copy isn't the one
  // currently open, and - worse - the submit Button's `form` attribute is a
  // global getElementById lookup, so a collision on the form id can silently
  // submit the OTHER (empty, closed) instance's form instead of this one's.
  const nameId = useId();
  const slugId = useId();
  const formId = useId();

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
      <Button type="submit" form={formId} loading={isSubmitting || mutation.isPending}>
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
        id={formId}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Alert message={mutation.isError ? mutation.error.message : null} />

        <FormField label="Name" htmlFor={nameId} required error={errors.name?.message}>
          <Input
            id={nameId}
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

        <FormField label="Slug" htmlFor={slugId} required error={errors.slug?.message}>
          <Input
            id={slugId}
            placeholder="acme-corp"
            hasError={!!errors.slug}
            {...register("slug")}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
