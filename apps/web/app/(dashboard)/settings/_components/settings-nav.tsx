"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type JSX } from "react";

import type { Role } from "@taskflow/shared";
import { cn } from "@taskflow/ui";

import { canAdminOrg } from "@/lib/utils/role";

interface SettingsNavProps {
  /** null when the user has no org - the Organization group is hidden entirely in that case. */
  orgName: string | null;
  role: Role | null;
}

interface NavLink {
  label: string;
  href: string;
}

const ACCOUNT_LINKS: NavLink[] = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Preferences", href: "/settings/preferences" },
];

/**
 * Settings' own secondary nav - two groups (Account, always; the active
 * org's settings, only when one exists). Org-scoped links are filtered by
 * role here so a MEMBER/VIEWER simply never sees a link to a page they
 * can't use - the pages themselves still gate independently (see
 * organization/page.tsx and labels/page.tsx) for anyone who navigates
 * there directly.
 */
export function SettingsNav({ orgName, role }: SettingsNavProps): JSX.Element {
  const pathname = usePathname();

  const orgLinks: NavLink[] = orgName
    ? [
        ...(role && canAdminOrg(role)
          ? [{ label: "General", href: "/settings/organization" }]
          : []),
        // Labels is member-readable (labels.list excludes only VIEWER) - a
        // MEMBER sees this link too, just without create/delete controls
        // once there (see LabelManager's canManage prop).
        ...(role && role !== "VIEWER" ? [{ label: "Labels", href: "/settings/labels" }] : []),
      ]
    : [];

  function renderLink(link: NavLink): JSX.Element {
    const isActive = pathname === link.href;
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "block rounded-md px-3 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-brand-50 font-medium text-brand-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )}
      >
        {link.label}
      </Link>
    );
  }

  return (
    <nav aria-label="Settings" className="flex w-48 shrink-0 flex-col gap-6">
      <div>
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Account
        </p>
        <div className="flex flex-col gap-0.5">{ACCOUNT_LINKS.map(renderLink)}</div>
      </div>

      {orgLinks.length > 0 && (
        <div>
          <p className="truncate px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {orgName}
          </p>
          <div className="flex flex-col gap-0.5">{orgLinks.map(renderLink)}</div>
        </div>
      )}
    </nav>
  );
}
