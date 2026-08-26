"use client";

import { api } from "@/lib/trpc/client";

interface UseCursorsHiddenResult {
  cursorsHidden: boolean;
  setCursorsHidden: (hidden: boolean) => void;
}

/**
 * Reads/writes the "hide peer cursors" preference for one org, stored on the
 * caller's own Membership row so it doesn't leak across orgs. Reads from the
 * orgs.list cache - already populated by the sidebar's org switcher on every
 * dashboard page - instead of issuing a redundant fetch of its own.
 */
export function useCursorsHidden(orgId: string): UseCursorsHiddenResult {
  const utils = api.useUtils();
  const { data: orgs } = api.orgs.list.useQuery();
  const cursorsHidden =
    orgs?.find((org) => org.id === orgId)?.memberships[0]?.cursorsHidden ?? false;

  const mutation = api.orgs.updateMyCursorPreference.useMutation({
    onMutate: async ({ cursorsHidden: next }) => {
      await utils.orgs.list.cancel();
      const previous = utils.orgs.list.getData();
      utils.orgs.list.setData(undefined, (prev) =>
        prev?.map((org) =>
          org.id === orgId
            ? { ...org, memberships: org.memberships.map((m) => ({ ...m, cursorsHidden: next })) }
            : org,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.orgs.list.setData(undefined, ctx.previous);
      }
    },
    onSettled: () => {
      void utils.orgs.list.invalidate();
    },
  });

  function setCursorsHidden(hidden: boolean): void {
    mutation.mutate({ orgId, cursorsHidden: hidden });
  }

  return { cursorsHidden, setCursorsHidden };
}
