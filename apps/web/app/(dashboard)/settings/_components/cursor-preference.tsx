"use client";

import { type JSX } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";

import { useCursorsHidden } from "@/lib/hooks/use-cursors-pref";
import { setCursorsHidden } from "@/lib/utils/cursor-pref";

/**
 * Board preference: show or hide other people's live cursors.
 *
 * Shares the exact same cookie-backed store as the in-board toggle
 * (useCursorsHidden / setCursorsHidden), so changing it here or on the board
 * stays in sync without any duplicated state.
 */
export function CursorPreference(): JSX.Element {
  const hidden = useCursorsHidden();

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
            setCursorsHidden(!hidden);
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
