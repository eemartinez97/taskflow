import type { ComponentType, JSX } from "react";

import { Button } from "@taskflow/ui";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  // Explicit `| undefined` (not just `?:`) - exactOptionalPropertyTypes
  // requires it since callers pass `action={cond ? {...} : undefined}`
  // rather than omitting the prop outright.
  action?:
    | {
        label: string;
        onClick: () => void;
      }
    | undefined;
}

/**
 * Compact empty state for a section that lives INSIDE an already-populated
 * page (Team's member roster, its invitations list) - a smaller, dashed-box
 * sibling to NoOrgState's full-page treatment (icon in a circle, heading,
 * description), reused here so every empty state in the app reads as one
 * family instead of three independently-invented ones.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
