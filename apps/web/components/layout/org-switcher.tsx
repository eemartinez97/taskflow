"use client";

import { type JSX, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Mail, Plus } from "lucide-react";

import { Badge, cn } from "@taskflow/ui";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CreateOrgDialog } from "@/components/organizations/create-org-dialog";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { useOutsideClick } from "@/lib/hooks/use-outside-click";
import { api } from "@/lib/trpc/client";
import {
  getServerActiveOrgId,
  readActiveOrgId,
  setActiveOrgId,
  subscribeActiveOrg,
} from "@/lib/utils/active-org";
import { hasUnsavedChanges } from "@/lib/utils/navigation-guard";
import { ROLE_BADGE_VARIANT } from "@/lib/utils/role";
import { userInitials } from "@/lib/utils/user";

/**
 * Organization switcher shown in the sidebar - a menu button, not a form
 * control, since it's the ONLY place in the app to see every org you belong
 * to, your role in each, jump to pending invitations, or create a new one
 * (Organizations was retired as a nav destination for exactly this reason -
 * see navigation.ts). Follows the WAI-ARIA menu-button pattern: the trigger
 * exposes aria-haspopup/aria-expanded, items are role="menuitem" with
 * ArrowUp/ArrowDown/Home/End moving focus among them and Escape closing and
 * returning focus to the trigger.
 *
 * Switching org always navigates to /projects of the new org - the current
 * URL's ids (project/board/task) almost certainly don't belong to it, so
 * staying on the same path caused a blank NOT_FOUND page. If any mounted
 * component reports unsaved changes (see navigation-guard.ts - currently the
 * task detail panel's form), a confirmation dialog runs first.
 */
interface OrgSwitcherProps {
  /** Renders an icon-only button (org switching + name/role has no compact
   * form of its own) that preserves the one thing collapse must not hide:
   * the pending-invitations count.
   *
   * Sidebar keys this component on collapsed state (`key={collapsed ? ... }`)
   * rather than this component resetting its own menu/dialog state on a
   * `collapsed` change - remounting on toggle is what makes menuOpen,
   * createDialog, confirmDialog, and pendingOrgId reset for free, the same
   * as before collapsing fully unmounted this component. Without that key,
   * e.g. opening the org menu then collapsing would leave menuOpen=true
   * sitting inert behind the compact button, popping back open with no
   * corresponding click the next time the sidebar expands. */
  collapsed?: boolean;
}

export function OrgSwitcher({ collapsed = false }: OrgSwitcherProps): JSX.Element | null {
  const router = useAppRouter();
  const pathname = usePathname();
  const { data: orgs } = api.orgs.list.useQuery();
  const { data: myInvitations } = api.invitations.listMine.useQuery();
  const activeId = useSyncExternalStore(subscribeActiveOrg, readActiveOrgId, getServerActiveOrgId);
  const createDialog = useDisclosure();
  const confirmDialog = useDisclosure();
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const invitationCount = myInvitations?.length ?? 0;

  useOutsideClick(containerRef, menuOpen, () => {
    setMenuOpen(false);
  });

  /**
   * Live DOM query rather than a manually-synced ref array: the org list can
   * shrink while the menu is open (e.g. an org removed), and reading
   * role="menuitem" elements straight from the DOM at call time can never go
   * stale the way a pre-built ref array could without its own truncation
   * effect.
   */
  function getMenuItems(): HTMLButtonElement[] {
    /* v8 ignore next -- only called from effects/handlers that run after this component has committed its (unconditional) container div, so the ref is always attached */
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
  }

  // Move focus onto the first menu item the moment the menu opens - the
  // WAI-ARIA menu-button pattern's default behavior for an Enter/Space/click
  // open (as opposed to ArrowUp, which would seed the LAST item instead; no
  // caller here does that, so first-item is the only case to handle).
  useEffect(() => {
    if (menuOpen) getMenuItems()[0]?.focus();
  }, [menuOpen]);

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

  // Defined up here (not down with the rest of the expanded-mode JSX) so the
  // collapsed branch below can render it too - a zero-org user still needs a
  // way to create their first org while collapsed, not just the invitations
  // icon.
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

  if (collapsed) {
    // Only the collapsed rail gets an active-state: here the button reads as
    // a primary nav item (same visual slot/weight as the NAV_ITEMS icons
    // above it), so it needs the same aria-current/highlight treatment.
    // Expanded, this same destination is one row inside the org-switcher
    // menu - clearly secondary there, so it intentionally gets none.
    const isInvitationsActive = pathname.startsWith("/invitations");
    return (
      <div className="flex flex-col items-center gap-1 py-3">
        {orgs?.length === 0 && (
          <button
            type="button"
            title="Create organization"
            aria-label="Create organization"
            onClick={createDialog.open}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white transition-colors hover:bg-brand-700"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          title="Pending invitations"
          aria-label={`Pending invitations${invitationCount > 0 ? `, ${String(invitationCount)}` : ""}`}
          aria-current={isInvitationsActive ? "page" : undefined}
          onClick={() => {
            router.push("/invitations");
          }}
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            isInvitationsActive
              ? "bg-brand-50 text-brand-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
          )}
        >
          <Mail aria-hidden="true" className="h-4 w-4" />
          {invitationCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-medium text-white"
            >
              {invitationCount > 9 ? "9+" : invitationCount}
            </span>
          )}
        </button>
        {createOrgDialog}
      </div>
    );
  }

  if (!orgs) return null;

  // Computed unconditionally (harmlessly undefined when orgs.length === 0,
  // the branch below never reads it in that case) so selectOrg's no-op
  // guard below can compare against the EFFECTIVE active org - activeId
  // alone is null whenever no cookie is set yet, even though activeOrg has
  // already fallen back to firstOrg and is what the trigger actually shows.
  const [firstOrg] = orgs;
  const matchedOrg = activeId ? orgs.find((org) => org.id === activeId) : undefined;
  const activeOrg = matchedOrg ?? firstOrg;
  const activeRole = activeOrg?.memberships[0]?.role ?? "VIEWER";

  function closeMenuAndFocusTrigger(): void {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }

  function selectOrg(orgId: string): void {
    if (orgId === activeOrg?.id) {
      closeMenuAndFocusTrigger();
      return;
    }

    if (hasUnsavedChanges()) {
      setPendingOrgId(orgId);
      setMenuOpen(false);
      confirmDialog.open();
      return;
    }

    closeMenuAndFocusTrigger();
    switchTo(orgId);
  }

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    // Always >= 2: the invitations and create rows below are unconditional
    // whenever this menu renders at all (the zero-orgs case returns its own
    // separate, menu-less JSX above) - no empty-items case to guard here.
    const items = getMenuItems();
    const currentIndex = items.findIndex((el) => el === document.activeElement);

    function focusAt(index: number): void {
      const wrapped = ((index % items.length) + items.length) % items.length;
      items[wrapped]?.focus();
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusAt(currentIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusAt(currentIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        closeMenuAndFocusTrigger();
        break;
      case "Tab":
        // Don't preventDefault - let focus move to the next tabbable element
        // as normal, just stop rendering the popover so it doesn't linger.
        setMenuOpen(false);
        break;
      default:
        break;
    }
  }

  if (orgs.length === 0) {
    return (
      <div className="flex flex-col">
        <button
          type="button"
          onClick={createDialog.open}
          className="flex h-full w-full cursor-pointer items-center justify-center gap-1.5 bg-brand-600 py-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Create organization
        </button>

        {/* No dropdown to tuck this into with zero orgs (nothing to switch
            between) - surfaced as its own row instead, mirroring the same
            always-visible "Pending invitations" row the populated branch
            below puts inside its menu (only ITS Badge is conditional there -
            this row must match, or a zero-org/zero-invitation user has no
            way to even navigate to /invitations to check). */}
        <button
          type="button"
          onClick={() => {
            router.push("/invitations");
          }}
          className="flex w-full items-center gap-2 border-t border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
        >
          <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1">Pending invitations</span>
          {invitationCount > 0 && <Badge variant="warning">{invitationCount}</Badge>}
        </button>

        {createOrgDialog}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="px-3 py-4">
      {/* `relative` scopes the menu's `top-full` to just this button, not the
      padded container above - otherwise the menu floats a full py-4 below
      the button instead of hugging it. */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          /* v8 ignore next -- activeOrg is always defined here: this JSX only renders past the orgs.length === 0 early return above, where firstOrg (its fallback) is guaranteed */
          aria-label={`Switch organization, current: ${activeOrg?.name ?? ""}${
            invitationCount > 0
              ? `, ${String(invitationCount)} pending invitation${invitationCount === 1 ? "" : "s"}`
              : ""
          }`}
          onClick={() => {
            setMenuOpen((prev) => !prev);
          }}
          onKeyDown={(e) => {
            // Standard menu-button affordance: Arrow keys open straight into
            // the list instead of requiring an extra Enter/Space first.
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setMenuOpen(true);
            }
          }}
          className={cn(
            "flex w-full items-center gap-2 border border-gray-200 bg-white px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            // Open state reads as the menu's own top edge - flat bottom
            // corners, no bottom border, and a pressed background - so the
            // button and the menu below it look like one continuous piece
            // instead of two unrelated boxes.
            menuOpen
              ? "rounded-t-md rounded-b-none border-b-0 bg-gray-50"
              : "rounded-md hover:bg-gray-50",
          )}
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-100 text-xs font-semibold text-brand-700"
          >
            {activeOrg && userInitials({ name: activeOrg.name })}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-gray-900">{activeOrg?.name}</span>
            <span className="text-xs text-gray-500">{activeRole}</span>
          </span>
          {invitationCount > 0 && (
            <Badge aria-hidden="true" variant="warning">
              {invitationCount}
            </Badge>
          )}
          <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="Organizations"
            onKeyDown={handleMenuKeyDown}
            className="absolute left-0 right-0 top-full z-50 rounded-b-md border border-t-0 border-gray-200 bg-white py-1 shadow-md"
          >
            <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Your organizations
            </div>

            {orgs.map((org) => {
              const role = org.memberships[0]?.role ?? "VIEWER";
              const isActive = org.id === activeOrg?.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  role="menuitem"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => {
                    selectOrg(org.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-[10px] font-semibold text-brand-700"
                  >
                    {userInitials({ name: org.name })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{org.name}</span>
                  <Badge variant={ROLE_BADGE_VARIANT[role]}>{role}</Badge>
                  <Check
                    aria-hidden="true"
                    className={cn("h-4 w-4 shrink-0 text-brand-600", !isActive && "invisible")}
                  />
                </button>
              );
            })}

            <div className="my-1 border-t border-gray-100" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                router.push("/invitations");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50"
            >
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="flex-1">Pending invitations</span>
              {invitationCount > 0 && <Badge variant="warning">{invitationCount}</Badge>}
            </button>

            <div className="my-1 border-t border-gray-100" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                createDialog.open();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50"
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
              Create organization
            </button>
          </div>
        )}
      </div>

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
