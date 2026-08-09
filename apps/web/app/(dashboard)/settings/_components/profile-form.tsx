"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { useEffect, type JSX } from "react";

import { updateUserSchema, type UpdateUser } from "@taskflow/shared";
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

import { UserAvatar } from "@/components/common/user-avatar";
import { toast } from "@/lib/toast/store";
import { api } from "@/lib/trpc/client";
import { emptyStringToNull } from "@/lib/utils/form";

export function ProfileForm(): JSX.Element {
  const { update } = useSession();
  const { data: me, isPending } = api.auth.me.useQuery();

  const mutation = api.auth.updateProfile.useMutation({
    meta: { skipErrorToast: true }, // shown inline below
    onSuccess: async (updated) => {
      toast.success("Profile updated.");
      // Refresh the JWT-backed session so the header updates immediately
      await update({ name: updated.name, image: updated.image });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateUser>({
    resolver: zodResolver(updateUserSchema),
    // Empty on mount; hydrated from auth.me once it resolves (see effect).
    defaultValues: { name: "", image: "" },
  });

  // Single source of truth: auth.me (DB). `defaultValues` is cached on the
  // first render only, so we sync the resolved values ONCE - but never while
  // the user is editing (`isDirty`), preserving in-progress input.
  useEffect(() => {
    if (!me || isDirty) return;
    reset({ name: me.name ?? "", image: me.image ?? "" });
  }, [me, isDirty, reset]);

  function onSubmit(data: UpdateUser): void {
    mutation.mutate(data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-sm flex-col gap-4">
          <Alert message={mutation.isError ? mutation.error.message : null} />

          <div className="flex items-center gap-3">
            <UserAvatar user={me ?? {}} size="md" />
            <span className="text-sm text-gray-500">{isPending ? "…" : (me?.email ?? "")}</span>
          </div>

          <FormField label="Name" htmlFor="profile-name" error={errors.name?.message}>
            <Input id="profile-name" hasError={!!errors.name} {...register("name")} />
          </FormField>

          <FormField label="Avatar URL" htmlFor="profile-image" error={errors.image?.message}>
            <Input
              id="profile-image"
              placeholder="https://…"
              hasError={!!errors.image}
              {...register("image", { setValueAs: emptyStringToNull })}
            />
          </FormField>

          <Button type="submit" loading={mutation.isPending} className="self-start">
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
