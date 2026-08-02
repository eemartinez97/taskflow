import type { JSX } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";

interface NoOrgStateProps {
  /** Optional context message shown below the main heading */
  context?: string;
}

/**
 * Shown when the current user has no organization.
 * Used across /projects, /tasks, /team, /settings.
 *
 * Single source of truth - never duplicate this empty state inline.
 */
export function NoOrgState({ context }: NoOrgStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <Building2 className="h-7 w-7 text-gray-400" />
      </div>

      <h2 className="text-base font-semibold text-gray-800">
        You&apos;re not part of any organization yet
      </h2>

      {context && <p className="mt-1 text-sm text-gray-500">{context}</p>}

      <p className="mt-3 text-sm text-gray-500">
        Ask your team owner to invite you,{" "}
        <Link
          href="/onboarding"
          className="font-medium text-brand-600 underline-offset-2 hover:underline"
        >
          or create one
        </Link>
        .
      </p>
    </div>
  );
}
