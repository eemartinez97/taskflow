"use client";

import { useState, type JSX } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@taskflow/ui";
import { type RegisterInput, registerSchema } from "@/lib/auth/schemas";

/**
 * Register page - Client Component.
 *
 * Calls POST /api/auth/register (plain Route Handler).
 * On success: redirect to /login with a "check your email" note.
 */

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterInput): Promise<void> {
    setServerError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.status === 409) {
      setServerError("An account with that email already exists.");
      return;
    }

    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setServerError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/login?registered=true");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {serverError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" required>
              Name
            </Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              hasError={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-red-600" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              hasError={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-600" role="alert">
                {" "}
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              hasError={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-red-600" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword" required>
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              hasError={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-600" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

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
