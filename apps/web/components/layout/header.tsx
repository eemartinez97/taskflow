"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@taskflow/ui";
import { type JSX } from "react";

interface HeaderProps {
  /** Page title shown in the top bar */
  title: string;
}

export function Header({ title }: HeaderProps): JSX.Element {
  const { data: session } = useSession();

  const initials = session?.user.name
    ? session.user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-3">
        <div
          aria-label={`User: ${session?.user.name ?? "Unknown"}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
        >
          {initials}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
