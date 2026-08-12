import "server-only";

import type { OrgWithMembership } from "@taskflow/database";

import type { getServerTRPC } from "@/lib/trpc/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
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
 */

export async function getOrgOrNull(
  trpc: Awaited<ReturnType<typeof getServerTRPC>>,
): Promise<OrgWithMembership | null> {
  const orgs = await trpc.orgs.list();
  const [firstOrg] = orgs;
  if (!firstOrg) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const active = activeId ? orgs.find((org) => org.id === activeId) : undefined;

  return active ?? firstOrg;
}

/**
 * Resolves a specific org by id for the `/organizations/[orgId]` detail
 * page. `trpc.orgs.list()` only ever returns orgs the caller is a member
 * of, so an id belonging to another org - or one that doesn't exist at all -
 * is indistinguishable here, and both 404 rather than leaking which case it
 * was.
 */
export async function getOrgByIdOrNotFound(
  trpc: Awaited<ReturnType<typeof getServerTRPC>>,
  orgId: string,
): Promise<OrgWithMembership> {
  const orgs = await trpc.orgs.list();
  const org = orgs.find((o) => o.id === orgId);
  if (!org) notFound();
  return org;
}
