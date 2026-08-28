"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { useEffect, useRef, type JSX } from "react";

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
  const utils = api.useUtils();

  const mutation = api.auth.updateProfile.useMutation({
    meta: { skipErrorToast: true }, // shown inline below
    onSuccess: async (updated) => {
      toast.success("Profile updated.");
      // Refresh the JWT-backed session so the header updates immediately, and
      // invalidate every tRPC-cached display of this user's name/avatar -
      // useSession().update() only fixes components reading the session
      // directly (header, board presence chip); it does nothing for the
      // settings preview itself or any other screen reading this same data
      // through a query (org member list, task assignee pickers/cards,
      // comment authors), which would otherwise show the old name until
      // that query's own 30s staleTime lapses or the page is refreshed.
      await Promise.all([
        update({ name: updated.name, image: updated.image }),
        utils.auth.me.invalidate(),
        utils.orgs.members.invalidate(),
        utils.orgs.assigneeLookup.invalidate(),
        utils.comments.list.invalidate(),
      ]);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateUser>({
    resolver: zodResolver(updateUserSchema),
    // Empty on mount; hydrated from auth.me once it resolves (see effect).
    defaultValues: { name: "", image: "" },
  });

  // Single source of truth: auth.me (DB). Syncs the resolved values into the
  // form exactly ONCE - a plain ref, not `isDirty` - so a stray dirty flag
  // (RHF can report isDirty:true with an empty dirtyFields set very briefly
  // right after mount, before any real user input) can never permanently
  // block this hydration. Once synced, further auth.me updates are ignored
  // so in-progress edits are never clobbered.
  const hasHydrated = useRef(false);
  useEffect(() => {
    if (!me || hasHydrated.current) return;
    hasHydrated.current = true;
    reset({ name: me.name ?? "", image: me.image ?? "" });
  }, [me, reset]);

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
