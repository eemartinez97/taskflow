"use client";

import type { JSX } from "react";

import type { InvitationPreview, InvitationPreviewState } from "@taskflow/shared";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";

import { useInvitationActions } from "@/components/invitations/use-invitation-actions";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { formatDate } from "@/lib/utils/date";

interface InvitationTokenClientProps {
  token: string;
  preview: InvitationPreview;
}

const TERMINAL_STATE_COPY: Record<
  Exclude<InvitationPreviewState, "VALID">,
  { title: string; description: string }
> = {
  EXPIRED: {
    title: "This invitation has expired",
    description: "Ask the organization's admin to resend it.",
  },
  REVOKED: {
    title: "This invitation was revoked",
    description: "The admin who sent it has cancelled the invitation.",
  },
  DECLINED: {
    title: "Invitation already declined",
    description: "You already declined this invitation.",
  },
  ALREADY_ACCEPTED: {
    title: "Invitation already accepted",
    description: "You're already a member of this organization.",
  },
  WRONG_ACCOUNT: {
    title: "Wrong account",
    description:
      "This invitation isn't addressed to the account you're signed in with. Sign in with the invited email address instead.",
  },
};

/** One UI branch per `preview.state` - see invitationPreviewStateSchema in @taskflow/shared. */
export function InvitationTokenClient({ token, preview }: InvitationTokenClientProps): JSX.Element {
  const router = useAppRouter();
  const { accept, decline, isAccepting, isDeclining } = useInvitationActions();

  if (preview.state !== "VALID") {
    const copy = TERMINAL_STATE_COPY[preview.state];
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-semibold text-gray-900">{copy.title}</h1>
        <p className="mt-2 text-sm text-gray-500">{copy.description}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <Card>
        <CardHeader>
          <CardTitle>You&apos;ve been invited to join {preview.orgName}</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <p className="text-sm text-gray-600">
            {preview.inviterName ?? "Someone"} invited you to join as{" "}
            <Badge variant="outline">{preview.role}</Badge>
          </p>
          <p className="text-xs text-gray-400">Expires {formatDate(preview.expiresAt)}</p>

          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              disabled={isDeclining}
              onClick={() => {
                decline(
                  { token },
                  {
                    onSuccess: () => {
                      router.push("/projects");
                    },
                  },
                );
              }}
            >
              Decline
            </Button>
            <Button
              disabled={isAccepting}
              onClick={() => {
                accept(
                  { token },
                  {
                    onSuccess: (result) => {
                      router.push(`/organizations/${result.orgId}`);
                    },
                  },
                );
              }}
            >
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
