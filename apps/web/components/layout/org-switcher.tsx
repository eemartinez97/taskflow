"use client";

import { type JSX, useState, useSyncExternalStore } from "react";
import { Plus } from "lucide-react";

import { Select } from "@taskflow/ui";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CreateOrgDialog } from "@/components/organizations/create-org-dialog";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { api } from "@/lib/trpc/client";
import {
  getServerActiveOrgId,
  readActiveOrgId,
  setActiveOrgId,
  subscribeActiveOrg,
} from "@/lib/utils/active-org";
import { hasUnsavedChanges } from "@/lib/utils/navigation-guard";
import { CREATE_ORG_VALUE } from "@/lib/constants/org-switcher";

/**
 * Organization switcher shown in the sidebar.
 *
 * Switching org always navigates to /projects of the new org - the current
 * URL's ids (project/board/task) almost certainly don't belong to it, so
 * staying on the same path caused a blank NOT_FOUND page. If any mounted
 * component reports unsaved changes (see navigation-guard.ts - currently the
 * task detail panel's form), a confirmation dialog runs first.
 */
export function OrgSwitcher(): JSX.Element | null {
  const router = useAppRouter();
  const { data: orgs } = api.orgs.list.useQuery();
  const activeId = useSyncExternalStore(subscribeActiveOrg, readActiveOrgId, getServerActiveOrgId);
  const createDialog = useDisclosure();
  const confirmDialog = useDisclosure();
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);

  if (!orgs) return null;

  function switchTo(orgId: string): void {
    // Only /projects of the NEW org has ids that make sense - always the nav
    // target. refresh() is what actually re-fetches data for the new active
    // org when we're already on /projects (push alone is a same-URL no-op
    // in that case) - useAppRouter tracks both calls' real completion via
    // React transitions, so the progress bar/content-dim show correctly
    // either way.
    setActiveOrgId(orgId);
    router.push("/projects");
    router.refresh();
  }

  const createOrgDialog = (
    <CreateOrgDialog
      open={createDialog.isOpen}
      onClose={createDialog.close}
      onCreated={(orgId) => {
        createDialog.close();
        switchTo(orgId);
      }}
    />
  );

  if (orgs.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={createDialog.open}
          className="flex h-full w-full cursor-pointer items-center justify-center gap-1.5 bg-brand-600 py-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Create organization
        </button>
        {createOrgDialog}
      </>
    );
  }

  const [firstOrg] = orgs;
  const matchedOrg = activeId ? orgs.find((org) => org.id === activeId) : undefined;
  /* v8 ignore next -- orgs.length > 0 is guaranteed by the branch above, so this always resolves to an id */
  const value = (matchedOrg ?? firstOrg)?.id ?? "";

  function handleChange(next: string): void {
    if (next === CREATE_ORG_VALUE) {
      createDialog.open();
      return;
    }

    if (hasUnsavedChanges()) {
      setPendingOrgId(next);
      confirmDialog.open();
      return;
    }

    switchTo(next);
  }

  return (
    <div className="flex flex-col gap-1.5 px-3 py-4">
      <label
        htmlFor="org-switcher"
        className="px-1 text-xs font-medium uppercase tracking-wide text-gray-400"
      >
        Organization
      </label>
      <Select
        id="org-switcher"
        aria-label="Select organization"
        value={value}
        onChange={(e) => {
          handleChange(e.target.value);
        }}
        className="w-full"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
        <option value={CREATE_ORG_VALUE}>＋ Create organization…</option>
      </Select>

      {createOrgDialog}

      <ConfirmDialog
        open={confirmDialog.isOpen}
        onClose={() => {
          setPendingOrgId(null);
          confirmDialog.close();
        }}
        onConfirm={() => {
          if (pendingOrgId) switchTo(pendingOrgId);
          confirmDialog.close();
        }}
        title="Unsaved changes"
        description="You have unsaved changes on this page. Switching organizations will discard them. Continue?"
        confirmLabel="Discard and switch"
        danger
      />
    </div>
  );
}
