"use client";
import { useState, type JSX } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Alert, Button, FormField, Input } from "@taskflow/ui";
import { resetPasswordSchema } from "@/lib/auth/schemas";
import { postJson } from "@/lib/utils/post-json";

export interface TokenPasswordInput {
  token: string;
  password: string;
  confirmPassword: string;
}

interface TokenPasswordFormProps {
  token: string;
  endpoint: string;
  redirectTo: string;
  passwordLabel: string;
  confirmLabel: string;
  submitLabel: string;
}

/** "Set a new password via emailed token" form - used by the password-reset flow. */
export function TokenPasswordForm({
  token,
  endpoint,
  redirectTo,
  passwordLabel,
  confirmLabel,
  submitLabel,
}: TokenPasswordFormProps): JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TokenPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  async function onSubmit(data: TokenPasswordInput): Promise<void> {
    setServerError(null);
    const { ok, body } = await postJson(endpoint, data);
    if (!ok) {
      setServerError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.push(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Alert message={serverError} />
      <input type="hidden" {...register("token")} />
      <FormField
        label={passwordLabel}
        htmlFor="password"
        required
        error={errors.password?.message}
      >
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
      <Button type="submit" fullWidth loading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
