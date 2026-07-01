"use client";

import Link from "next/link";
import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button, Card, CardHeader, CardTitle, Input, CardContent, Label } from "@taskflow/ui";
import { type LoginInput, loginSchema } from "@/lib/auth/schemas";

/**
 * Login page - Client Component (uses hooks and signIn),
 *
 * Uses react-hook-form _ zodResolver for client-side validation
 * then calls NextAuth v4 `signIn("credentials", {...})`.
 *
 * On success: redirect to /dashboard.
 * On failure: display the NextAuth error message inline.
 */

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput): Promise<void> {
    setServerError(null);

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError("Invalid email or password. Please try again.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to TaskFlow</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {serverError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}

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
              autoComplete="current-password"
              hasError={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-red-600" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" fullWidth loading={isSubmitting}>
            Sign in
          </Button>

          <p className="text-center text-sm text-gray-500">
            {"Don't have an account? "}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
