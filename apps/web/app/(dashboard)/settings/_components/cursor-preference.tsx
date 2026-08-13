"use client";

import { type JSX } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";

import { useCursorsHidden } from "@/lib/hooks/use-cursors-pref";
import { toast } from "@/lib/toast/store";

interface CursorPreferenceProps {
  orgId: string;
}

/**
 * Board preference: show or hide other people's live cursors, for one org.
 *
 * Shares the exact same DB-backed preference as the in-board toggle
 * (both call useCursorsHidden(orgId)), so changing it here or on the board
 * stays in sync without any duplicated state.
 */
export function CursorPreference({ orgId }: CursorPreferenceProps): JSX.Element {
  const { cursorsHidden: hidden, setCursorsHidden } = useCursorsHidden(orgId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live cursors</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Show teammates&apos; cursors</p>
          <p className="text-xs text-gray-500">
            Display other members&apos; pointers in real time while viewing a board. This only
            affects what you see - your cursor is still shared with your team.
          </p>
        </div>
        <Button
          variant={hidden ? "secondary" : "primary"}
          size="sm"
          aria-pressed={!hidden}
          onClick={() => {
            const next = !hidden;
            setCursorsHidden(next);
            toast.success(next ? "Teammates' cursors hidden." : "Teammates' cursors visible.");
          }}
          className="shrink-0"
        >
          {hidden ? (
            <>
              <EyeOff className="mr-1.5 h-4 w-4" />
              Hidden
            </>
          ) : (
            <>
              <Eye className="mr-1.5 h-4 w-4" />
              Visible
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
