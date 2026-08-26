/**
 * Generic "unsaved changes" registry for cross-cutting navigation actions
 * (currently: the org switcher). Any component holding potentially-unsaved
 * state (e.g. TaskDetailPanel's form) registers a check function while
 * mounted; `hasUnsavedChanges()` ORs every registered check.
 *
 * Deliberately in-memory (not persisted) - this is ephemeral UI state, not a
 * user preference like active-org.
 */
type DirtyCheck = () => boolean;

const checks = new Set<DirtyCheck>();

/** Registers a dirty-check; returns the unregister function (call on unmount). */
export function registerDirtyCheck(check: DirtyCheck): () => void {
  checks.add(check);
  return () => {
    checks.delete(check);
  };
}

/** True when ANY registered component currently reports unsaved changes. */
export function hasUnsavedChanges(): boolean {
  for (const check of checks) {
    if (check()) return true;
  }
  return false;
}
