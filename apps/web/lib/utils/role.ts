import type { Role } from "@taskflow/shared";
import type { BadgeProps } from "@taskflow/ui";

/**
 * Role-checking helpers - single source of truth for RBAC in the UI.
 *
 * WHY functions instead of inline comparisons:
 * - Eliminates repeated `role === "OWNER" || role === "ADMIN"` literals.
 * - A future role change (e.g. adding "SUPER_ADMIN") requires editing one
 *   file instead of grepping the entire codebase.
 */

/** True for roles that can perform admin-level mutations (update/delete org, project). */
export function canAdminOrg(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * True for roles that can create/update content (task, comments, boards).
 * Does NOT include VIEWER - read-only
 */
export function canMutateInOrg(role: Role): boolean {
  return canAdminOrg(role) || role === "MEMBER";
}

/** True only for the organization owner. */
export function isOrgOwner(role: Role): boolean {
  return role === "OWNER";
}

/** Badge variant per role - single source of truth, shared by MembersSection and OrgSwitcher. */
export const ROLE_BADGE_VARIANT: Record<Role, NonNullable<BadgeProps["variant"]>> = {
  OWNER: "default",
  ADMIN: "success",
  MEMBER: "outline",
  VIEWER: "outline",
};
