"use client";

import Link from "next/link";
import { Suspense, useState, useSyncExternalStore, type JSX } from "react";
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

/** Maps a known query flag to a one-line success message shown above the form. */
export function successMessageFor(params: URLSearchParams): string | null {
  if (params.get("activated")) return "Your account is now active. Sign in to continue.";
  if (params.get("reset")) return "Your password was reset. Sign in with your new password.";
  return null;
}

/**
 * The query string never changes on its own for the lifetime of this page
 * (getting a new one means a full navigation, which remounts the
 * component) - so useSyncExternalStore's subscribe never has anything to
 * notify and can be a no-op.
 */
function subscribeToSuccessMessage(): () => void {
  return () => undefined;
}

function getSuccessMessageSnapshot(): string | null {
  return successMessageFor(new URLSearchParams(window.location.search));
}

/**
 * Matches the server-rendered HTML (no `window` on the server, so no query
 * string to read). useSyncExternalStore uses this for the client's FIRST
 * hydration render specifically so that render matches the server's byte
 * for byte, then immediately re-renders with getSuccessMessageSnapshot's
 * real value - the framework-supported way to reconcile a value that
 * legitimately differs between server and client without triggering a
 * hydration-mismatch error (unlike a lazy useState initializer, which reads
 * `window` on the very first render and desyncs from the server output) or
 * the cascading-render setState-in-effect anti-pattern (unlike a plain
 * useEffect + setState).
 */
export function getSuccessMessageServerSnapshot(): string | null {
  return null;
}

/**
 * Reads the ?callbackUrl the proxy attached when it redirected an
 * unauthenticated user, and validates it is a same-origin relative path
 * (rejecting "//evil.com" style open redirects).
 *
 * Whitelists the character set instead of just checking the leading slash:
 * `router.push()` parses the string via `new URL()`, which strips tabs and
 * newlines per the WHATWG URL spec BEFORE the origin check runs - a raw
 * value like "/\t/evil.com" passes a naive `startsWith("/") &&
 * !startsWith("//")` check as text but normalizes to "//evil.com" and
 * triggers a real cross-origin navigation. No tab/newline/backslash/control
 * character is in this charset, so that normalization can't produce "//".
 *
 * Read inside the submit handler via window.location instead of
 * useSearchParams: the hook would force a Suspense boundary around the page
 * under Next 16 cacheComponents, and an event handler is browser-only anyway.
 */
const SAFE_RELATIVE_CALLBACK_URL = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/;

function getCallbackUrl(): string {
  const raw = new URLSearchParams(window.location.search).get("callbackUrl");
  return raw && SAFE_RELATIVE_CALLBACK_URL.test(raw) ? raw : "/projects";
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

function LoginForm(): JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  // Reading window.location directly here - not via useSearchParams - avoids
  // forcing a Suspense boundary under Next 16 cacheComponents, same
  // rationale as getCallbackUrl above. See getSuccessMessageServerSnapshot's
  // docblock for why useSyncExternalStore (not a lazy useState initializer,
  // not useEffect) is what actually reads it.
  const successMessage = useSyncExternalStore(
    subscribeToSuccessMessage,
    getSuccessMessageSnapshot,
    getSuccessMessageServerSnapshot,
  );

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
          <Alert variant="success" message={successMessage} />

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

          <div className="-mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Forgot your password?
            </Link>
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

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
