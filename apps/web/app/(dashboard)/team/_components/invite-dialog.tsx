"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { type JSX } from "react";

import { inviteMemberSchema, ROLES } from "@taskflow/shared";
import type { z } from "zod";
import { Alert, Button, Dialog, FormField, Input, Select } from "@taskflow/ui";

import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { createDialogCloseHandler } from "@/lib/utils/form";

type InviteFormValues = z.infer<typeof inviteMemberSchema>;

interface InviteDialogProps {
  orgId: string;
  open: boolean;
  onClose: () => void;
}

const DEFAULT_VALUES: InviteFormValues = { email: "", role: "MEMBER" };

/**
 * Always invites into `orgId` - the currently active org (Team is scoped to
 * it, there's no other org context on this page). Targets
 * `invitations.create` (not the deprecated `orgs.invite`).
 */
export function InviteDialog({ orgId, open, onClose }: InviteDialogProps): JSX.Element {
  const utils = api.useUtils();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const mutation = api.invitations.create.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: () => {
      toast.success("Invitation sent.");
      void utils.invitations.listForOrg.invalidate({ orgId });
      reset(DEFAULT_VALUES);
      onClose();
    },
  });

  function onSubmit(data: InviteFormValues): void {
    mutation.mutate({ orgId, data });
  }

  const handleClose = createDialogCloseHandler(reset, mutation, onClose, DEFAULT_VALUES);

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose}>
        Close
      </Button>
      <Button type="submit" form="invite-form" loading={isSubmitting || mutation.isPending}>
        Send invite
      </Button>
    </>
  );

  return (
    <Dialog open={open} onClose={handleClose} title="Invite member" footer={footer}>
      <form
        id="invite-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Alert message={mutation.isError ? mutation.error.message : null} />

        <FormField label="Email" htmlFor="inv-email" required error={errors.email?.message}>
          <Input id="inv-email" type="email" hasError={!!errors.email} {...register("email")} />
        </FormField>

        <FormField label="Role" htmlFor="inv-role" required error={errors.role?.message}>
          <Select id="inv-role" {...register("role")}>
            {ROLES.filter((r) => r !== "OWNER").map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </FormField>
      </form>
    </Dialog>
  );
}
