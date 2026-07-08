import type { Metadata } from "next";
import type { JSX } from "react";

import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage(): Promise<JSX.Element> {
  await requireSession();
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
      <p className="mt-2 text-sm text-gray-500">Coming in a future release.</p>
    </div>
  );
}
