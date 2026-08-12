"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { type JSX } from "react";

import { idSchema, inviteMemberSchema, ROLES } from "@taskflow/shared";
import type { z } from "zod";
import { Alert, Button, Dialog, FormField, Input, Select } from "@taskflow/ui";

import { canAdminOrg } from "@/lib/utils/role";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { createDialogCloseHandler } from "@/lib/utils/form";

const inviteFormSchema = inviteMemberSchema.extend({ orgId: idSchema });
type InviteFormValues = z.infer<typeof inviteFormSchema>;

interface InviteDialogProps {
  orgId: string;
  orgName: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Targets `invitations.create` (not the deprecated `orgs.invite`) and lets
 * the sender pick ANY org they can admin, not just the one whose page they
 * opened this from - the "Current (<name>)" option marks which one that is.
 */
export function InviteDialog({ orgId, orgName, open, onClose }: InviteDialogProps): JSX.Element {
  const utils = api.useUtils();
  const { data: orgs } = api.orgs.list.useQuery();
  const adminOrgs = (orgs ?? []).filter((o) => canAdminOrg(o.memberships[0]?.role ?? "VIEWER"));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { role: "MEMBER", orgId },
  });

  const mutation = api.invitations.create.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: (_res, variables) => {
      toast.success("Invitation sent.");
      void utils.invitations.listForOrg.invalidate({ orgId: variables.orgId });
      reset({ email: "", role: "MEMBER" as const, orgId });
      onClose();
    },
  });

  function onSubmit(data: InviteFormValues): void {
    mutation.mutate({ orgId: data.orgId, data: { email: data.email, role: data.role } });
  }

  const handleClose = createDialogCloseHandler(reset, mutation, onClose, {
    email: "",
    role: "MEMBER" as const,
    orgId,
  });

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

        <FormField label="Organization" htmlFor="inv-org" required error={errors.orgId?.message}>
          <Select id="inv-org" {...register("orgId")}>
            {adminOrgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id === orgId ? `Current (${orgName})` : o.name}
              </option>
            ))}
          </Select>
        </FormField>
      </form>
    </Dialog>
  );
}
