import "server-only";

import type { OrgWithMembership } from "@taskflow/database";

import type { getServerTRPC } from "@/lib/trpc/server";
import { cache } from "react";
import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE } from "./active-org";

/**
 * Resolves the current user's active organization.
 *
 * Preference order:
 * 1. The org referenced by the `taskflow.activeOrgId` cookie, when the user is
 *    still a member of it (supports users belonging to several orgs).
 * 2. The first org the user belongs to.
 * 3. `null` when the user has no orgs.
 *
 * The membership guard also self-heals a stale cookie (e.g. after the active
 * org is deleted or the user is removed from it) by falling back to orgs[0].
 *
 * Wrapped in React cache() - Settings' layout.tsx AND whichever sub-page is
 * active both call this in the same request, and `trpc` is itself the same
 * cache()-memoized instance across both call sites (see getServerTRPC), so
 * this collapses to one real orgs.list() call instead of two.
 */
export const getOrgOrNull = cache(
  async (trpc: Awaited<ReturnType<typeof getServerTRPC>>): Promise<OrgWithMembership | null> => {
    const orgs = await trpc.orgs.list();
    const [firstOrg] = orgs;
    if (!firstOrg) return null;

    const cookieStore = await cookies();
    const activeId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    const active = activeId ? orgs.find((org) => org.id === activeId) : undefined;

    return active ?? firstOrg;
  },
);
