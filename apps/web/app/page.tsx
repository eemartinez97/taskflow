import Link from "next/link";
import type { JSX } from "react";

/**
 * Public landing page - Server Component.
 */
export default function HomePage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">TaskFlow</h1>
        <p className="mt-3 text-lg text-gray-500">
          Project management with real-time collaboration.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
