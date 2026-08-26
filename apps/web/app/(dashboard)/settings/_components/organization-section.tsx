"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type JSX } from "react";

import type { Org } from "@taskflow/database";
import { updateOrgSchema, type Role, type UpdateOrg } from "@taskflow/shared";
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

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { isOrgOwner } from "@/lib/utils/role";
import { clearActiveOrgId } from "@/lib/utils/active-org";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";

interface OrganizationSectionProps {
  org: Org;
  role: Role;
}

/**
 * Only mounted by SettingsPage when canAdminOrg(role) - so no admin check
 * needed inside for the rename form itself. The danger zone is narrower
 * still (OWNER only), gated locally.
 */
export function OrganizationSection({ org, role }: OrganizationSectionProps): JSX.Element {
  const router = useAppRouter();
  const utils = api.useUtils();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateOrg>({
    resolver: zodResolver(updateOrgSchema),
    defaultValues: { name: org.name, slug: org.slug },
  });

  const updateMutation = api.orgs.update.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: () => {
      toast.success("Organization updated.");
      void utils.orgs.list.invalidate();
      // The `org` prop is an RSC-fetched snapshot, not wired to orgs.list -
      // without a refresh, the danger zone's copy and its delete confirmText
      // gate would keep reflecting the pre-rename name. The rename form
      // itself is untouched by this (react-hook-form's defaultValues are
      // captured once at mount), so it keeps showing what was just typed.
      router.refresh();
    },
  });

  const deleteMutation = api.orgs.delete.useMutation({
    onSuccess: () => {
      toast.success("Organization deleted.");
      // Reset the active org so getOrgOrNull self-heals to a remaining one.
      clearActiveOrgId();
      void utils.orgs.list.invalidate();
      setDeleteOpen(false);
      router.refresh();
    },
  });

  function onSubmit(data: UpdateOrg): void {
    updateMutation.mutate({ orgId: org.id, data });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex max-w-sm flex-col gap-4"
          >
            <Alert message={updateMutation.isError ? updateMutation.error.message : null} />

            <FormField label="Name" htmlFor="org-name" required error={errors.name?.message}>
              <Input id="org-name" hasError={!!errors.name} {...register("name")} />
            </FormField>

            <FormField label="Slug" htmlFor="org-slug" required error={errors.slug?.message}>
              <Input id="org-slug" hasError={!!errors.slug} {...register("slug")} />
            </FormField>

            <Button
              type="submit"
              loading={isSubmitting || updateMutation.isPending}
              className="self-start"
            >
              Save organization
            </Button>
          </form>
        </CardContent>
      </Card>

      {isOrgOwner(role) && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-600">
                Permanently delete {org.name} and all of its projects, boards and tasks.
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteOpen(true);
                }}
              >
                Delete organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          deleteMutation.mutate({ orgId: org.id });
        }}
        title="Delete organization"
        description={`You are about to permanently delete "${org.name}" and all of its projects, boards and tasks.`}
        confirmText={org.name}
        confirmLabel="Yes, delete everything"
        loading={deleteMutation.isPending}
        danger
      />
    </>
  );
}
