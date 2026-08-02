"use client";

import Link from "next/link";
import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Input,
  CardContent,
  FormField,
  Alert,
} from "@taskflow/ui";
import { type LoginInput, loginSchema } from "@/lib/auth/schemas";

/**
 * Reads the ?callbackUrl the proxy attached when it redirected an
 * unauthenticated user, and validates it is a same-origin relative path
 * (rejecting "//evil.com" style open redirects).
 *
 * Read inside the submit handler via window.location instead of
 * useSearchParams: the hook would force a Suspense boundary around the page
 * under Next 16 cacheComponents, and an event handler is browser-only anyway.
 */

function getCallbackUrl(): string {
  const raw = new URLSearchParams(window.location.search).get("callbackUrl");
  return raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/projects";
}

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

    router.push(getCallbackUrl());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to TaskFlow</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Alert message={serverError} />

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
              autoComplete="current-password"
              hasError={!!errors.password}
              {...register("password")}
            />
          </FormField>

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
