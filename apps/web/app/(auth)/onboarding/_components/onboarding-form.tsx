"use client";

import { type JSX } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { createOrgSchema, type CreateOrg } from "@taskflow/shared";

import { api } from "@/lib/trpc/client";
import { deriveSlug } from "@/lib/utils/derive";
import { setActiveOrgId } from "@/lib/utils/active-org";
import { createDerivedFieldHandler } from "@/lib/hooks/use-derived-field";

/**
 * Post-registration onboarding page.
 * Uses orgs.create - the only tRPC mutation not reachable from any other page
 * for first-time users.
 */

export default function OnboardingForm(): JSX.Element {
  const router = useRouter();
  const utils = api.useUtils();

  const mutation = api.orgs.create.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: (org) => {
      // Make the freshly created org the active one so getOrgOrNull selects it
      // even when the user already belongs to other organizations.
      setActiveOrgId(org.id);
      void utils.orgs.list.invalidate();
      router.push("/projects");
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<CreateOrg>({ resolver: zodResolver(createOrgSchema) });

  function onSubmit(data: CreateOrg): void {
    mutation.mutate(data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your organization</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          An organization groups your projects and team members.
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Alert message={mutation.isError ? mutation.error.message : null} />

          <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
            <Input
              id="name"
              placeholder="Acme Corp"
              hasError={!!errors.name}
              {...register("name", {
                onChange: createDerivedFieldHandler(
                  setValue,
                  Boolean(dirtyFields.slug),
                  "slug",
                  deriveSlug,
                ),
              })}
            />
          </FormField>

          <FormField label="Slug" htmlFor="slug" required error={errors.slug?.message}>
            <Input
              id="slug"
              placeholder="acme-corp"
              hasError={!!errors.slug}
              {...register("slug")}
            />
          </FormField>

          <Button type="submit" fullWidth loading={isSubmitting || mutation.isPending}>
            Create Organization
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
