"use client";
import { type JSX } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
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
import { type ForgotPasswordInput, forgotPasswordSchema } from "@taskflow/shared";
import { api } from "@/lib/trpc/client";

/**
 * Requests a password-reset email. Always shows the same success message
 * on submit regardless of whether the account exists - auth.requestPasswordReset
 * enforces this server-side too, this UI just mirrors it so there's no
 * client-side tell either. Even a thrown error (rate limited aside) never
 * distinguishes itself here - see that procedure's docblock.
 */
export default function ForgotPasswordPage(): JSX.Element {
  const mutation = api.auth.requestPasswordReset.useMutation({ meta: { skipErrorToast: true } });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  function onSubmit(data: ForgotPasswordInput): void {
    mutation.mutate(data);
  }

  if (mutation.isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            If an account exists for that email, we&apos;ve sent instructions to reset your
            password. The link expires in 1 hour.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Alert message={mutation.isError ? mutation.error.message : null} />
          <p className="text-sm text-gray-500">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
          <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              hasError={!!errors.email}
              {...register("email")}
            />
          </FormField>
          <Button type="submit" fullWidth loading={mutation.isPending}>
            Send reset link
          </Button>
          <p className="text-center text-sm text-gray-500">
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
