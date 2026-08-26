import type { Metadata } from "next";
import type { JSX } from "react";

import { PendingInvitations } from "@/components/invitations/pending-invitations";

export const metadata: Metadata = { title: "Invitation" };

/** The signed-in user's own pending invitations, reached from the org switcher's badge. */
export default function InvitationsPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-gray-900">Invitations</h2>
      <PendingInvitations />
    </div>
  );
}
