"use client";
import { type JSX } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@taskflow/ui";
import { type InvitableRole, type RegisterInput, registerSchema } from "@taskflow/shared";
import { api } from "@/lib/trpc/client";

export interface RegisterFormInvitePreview {
  email: string;
  orgName: string;
  role: InvitableRole;
}

interface RegisterFormProps {
  /** Present when the page was opened via /register?invite=<token>. */
  inviteToken: string | null;
  /** Resolved public preview for `inviteToken` - null when there's no token,
   * the token doesn't resolve, or the invitation is no longer VALID (a
   * stale/leaked link silently falls back to ordinary registration). */
  invitePreview: RegisterFormInvitePreview | null;
}

/**
 * Collects name, email, and password in one step. auth.register creates the
 * account and emails a confirmation link; no session is created here - the
 * account cannot sign in until that link is confirmed at /verify-email (see
 * auth.verifyCredentials's `emailVerified` guard).
 *
 * When opened from an invite link, the email is prefilled and made
 * `readOnly` (never `disabled` - a disabled input is excluded from both
 * submission and react-hook-form's value) so a stray edit can't silently
 * register the WRONG address against the invitation.
 */
export function RegisterForm({ inviteToken, invitePreview }: RegisterFormProps): JSX.Element {
  const mutation = api.auth.register.useMutation({ meta: { skipErrorToast: true } });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    ...(invitePreview ? { defaultValues: { email: invitePreview.email } } : {}),
  });

  function onSubmit(data: RegisterInput): void {
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
            We sent a confirmation link to your email address. Click it to activate your account,
            then sign in. The link expires in 1 hour.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isConflict = mutation.isError && mutation.error.data?.code === "CONFLICT";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
      </CardHeader>
      <CardContent>
        {invitePreview && (
          <div className="mb-4 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
            You&apos;ve been invited to join <strong>{invitePreview.orgName}</strong> as{" "}
            <Badge variant="outline">{invitePreview.role}</Badge>. Create an account to accept.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Alert message={mutation.isError ? mutation.error.message : null} />

          {isConflict && inviteToken && (
            <p className="text-sm text-gray-600">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/invitations/${inviteToken}`)}`}
                className="font-medium text-brand-600 hover:underline"
              >
                Sign in to accept this invitation
              </Link>
            </p>
          )}

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
              readOnly={!!invitePreview}
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
          <Button type="submit" fullWidth loading={mutation.isPending}>
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
