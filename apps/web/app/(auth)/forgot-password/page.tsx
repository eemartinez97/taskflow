"use client";
import { useState, type JSX } from "react";
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
import { type ForgotPasswordInput, forgotPasswordSchema } from "@/lib/auth/schemas";
import { postJson } from "@/lib/utils/post-json";

/**
 * Requests a password-reset email. Always shows the same success message
 * on submit regardless of whether the account exists - the server enforces
 * this too (see /api/auth/forgot-password), this UI just mirrors it so
 * there's no client-side tell either.
 */
export default function ForgotPasswordPage(): JSX.Element {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordInput): Promise<void> {
    setServerError(null);
    const { ok, body } = await postJson("/api/auth/forgot-password", data);
    if (!ok) {
      setServerError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
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
          <Alert message={serverError} />
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
          <Button type="submit" fullWidth loading={isSubmitting}>
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
