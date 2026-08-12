import type { FieldValues, UseFormReset } from "react-hook-form";

/**
 * react-hook-form `setValueAs` helpers for optional text fields.
 *
 * `typeof v !== "string"` guards against RHF invoking the transform with a
 * stale/missing value during an unmount race (e.g. blurring a focused field
 * right as its component is removed from the DOM sets its ref to null before
 * the async handleSubmit chain finishes reading it). Without this guard,
 * `v.trim()` crashes with "Cannot read properties of null (reading 'trim')".
 *
 * Single source of truth - reuse instead of inlining `(v) => v.trim() === "" ? null : v`
 * in every optional-text-field registration.
 */

/** Trims and normalizes an optional free-text field; empty input -> null. */
export function emptyStringToNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

/** Same, for optional (non-nullable) schemas where empty input -> undefined. */
export function emptyStringToUndefined(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Same guard for <select>-style values (no trimming - ids aren't free text). */
export function selectValueToNull(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

/**
 * Returns a dialog close handler that resets the RHF form (optionally to
 * `defaultValues`), resets the mutation's error/success state, then invokes
 * `onClose`.
 *
 * Eliminates the copy-pasted:
 *   function handleClose(): void { reset(...); mutation.reset(); onClose(); }
 * previously duplicated across CreateProjectDialog, EditProjectDialog,
 * CreateBoardDialog, CreateOrgDialog and InviteDialog.
 */
export function createDialogCloseHandler<TFieldValues extends FieldValues>(
  reset: UseFormReset<TFieldValues>,
  mutation: { reset: () => void },
  onClose: () => void,
  defaultValues?: TFieldValues,
): () => void {
  return () => {
    reset(defaultValues);
    mutation.reset();
    onClose();
  };
}
