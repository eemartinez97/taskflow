"use client";
import { type JSX } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Alert, Button, FormField, Input } from "@taskflow/ui";
import { resetPasswordSchema } from "@taskflow/shared";
import { api } from "@/lib/trpc/client";

export interface TokenPasswordInput {
  token: string;
  password: string;
  confirmPassword: string;
}

interface TokenPasswordFormProps {
  token: string;
  redirectTo: string;
  passwordLabel: string;
  confirmLabel: string;
  submitLabel: string;
}

/**
 * "Set a new password via emailed token" form - used by the password-reset
 * flow. Only one caller (ResetPasswordForm) and one target procedure
 * (auth.resetPassword) exist today - kept as its own component for the
 * label/redirect props' sake, not because another token-consuming mutation
 * is expected.
 */
export function TokenPasswordForm({
  token,
  redirectTo,
  passwordLabel,
  confirmLabel,
  submitLabel,
}: TokenPasswordFormProps): JSX.Element {
  const router = useRouter();
  const mutation = api.auth.resetPassword.useMutation({
    meta: { skipErrorToast: true },
    onSuccess: () => {
      router.push(redirectTo);
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TokenPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  function onSubmit(data: TokenPasswordInput): void {
    mutation.mutate(data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Alert message={mutation.isError ? mutation.error.message : null} />
      <input type="hidden" {...register("token")} />
      <FormField label={passwordLabel} htmlFor="password" required error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          hasError={!!errors.password}
          {...register("password")}
        />
      </FormField>
      <p className="text-xs text-gray-400">
        At least 10 characters, with uppercase, lowercase, a number and a symbol.
      </p>
      <FormField
        label={confirmLabel}
        htmlFor="confirmPassword"
        required
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          hasError={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
      </FormField>
      <Button type="submit" fullWidth loading={mutation.isPending}>
        {submitLabel}
      </Button>
    </form>
  );
}
