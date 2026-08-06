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
import { type RegisterInput, registerSchema } from "@/lib/auth/schemas";
import { postJson } from "@/lib/utils/post-json";

/**
 * Register page (Client Component).
 *
 * Collects name, email, and password in one step. POST /api/auth/register
 * creates the account and emails a confirmation link; no session is created
 * here - the account cannot sign in until that link is confirmed at
 * /verify-email (see authorizeCredentials's `emailVerified` guard).
 */
export default function RegisterPage(): JSX.Element {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterInput): Promise<void> {
    setServerError(null);
    const { ok, status, body } = await postJson("/api/auth/register", data);
    if (status === 409) {
      setServerError("An account with that email already exists.");
      return;
    }
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
            We sent a confirmation link to your email address. Click it to activate your account,
            then sign in. The link expires in 1 hour.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Alert message={serverError} />
          <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              hasError={!!errors.name}
              {...register("name")}
            />
          </FormField>
          <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              hasError={!!errors.email}
              {...register("email")}
            />
          </FormField>
          <FormField label="Password" htmlFor="password" required error={errors.password?.message}>
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
            label="Confirm Password"
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
            Create account
          </Button>
          <p className="text-center text-sm text-gray-500">
            {"Already have an account? "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
