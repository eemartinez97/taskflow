"use client";

import { useMemo } from "react";

import type { FormerAssignee, MembershipWithUser } from "@taskflow/database";

import { api } from "@/lib/trpc/client";

export interface AssigneeUser {
  id: string;
  name: string | null;
  email: string | null;
  isFormer?: boolean;
}

export interface AssigneeLookup {
  members: MembershipWithUser[];
  formerAssignees: FormerAssignee[];
  assigneeById: Map<string, AssigneeUser>;
  isPending: boolean;
}

/**
 * Ex-members can still be assigned to tasks (attribution is preserved when
 * someone leaves/is removed - see apps/api's removeMembershipAndNotify), so
 * assigneeById merges both groups instead of only ever knowing about current
 * members and silently rendering their tasks as unassigned. Shared by
 * kanban-board.tsx and task-detail-panel.tsx so both assignee pickers agree
 * on one merge order and one loading state - and react-query dedupes the
 * identical-key query across callers, so this isn't a double network fetch.
 * Uses the combined `orgs.assigneeLookup` query (one round trip for both
 * groups) rather than `orgs.members` + `orgs.formerAssignees` separately -
 * this runs on the hottest page in the app, and the common case (no
 * ex-member tasks yet) would otherwise pay a full second round trip for an
 * empty array.
 */
export function useAssigneeLookup(orgId: string): AssigneeLookup {
  const lookupQuery = api.orgs.assigneeLookup.useQuery({ orgId });
  // Kept as the raw (possibly undefined) query data for the useMemo deps
  // below - a fresh `?? []` on every render would give the memo a new array
  // identity each time and defeat memoization entirely.
  const members = lookupQuery.data?.members;
  const formerAssignees = lookupQuery.data?.formerAssignees;

  const assigneeById = useMemo(() => {
    const map = new Map<string, AssigneeUser>((members ?? []).map((m) => [m.user.id, m.user]));
    for (const former of formerAssignees ?? []) {
      // A current member always wins over a stale formerAssignees entry -
      // the two queries can momentarily disagree across a refetch even
      // though the backend guarantees they're mutually exclusive at fetch
      // time (findFormerAssignees excludes anyone with a live membership).
      if (!map.has(former.id)) {
        map.set(former.id, { id: former.id, name: former.name, email: null, isFormer: true });
      }
    }
    return map;
  }, [members, formerAssignees]);

  return {
    members: members ?? [],
    formerAssignees: formerAssignees ?? [],
    assigneeById,
    isPending: lookupQuery.isPending,
  };
}
