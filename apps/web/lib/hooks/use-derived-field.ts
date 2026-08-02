"use client";
import type { ChangeEvent } from "react";
import type { FieldValues, Path, PathValue, UseFormSetValue } from "react-hook-form";
/**
 * Builds an `onChange` handler that auto-derives a target field's value from
 * a source input's value (e.g. slug from name) until the user edits the
 * target field directly.
 *
 * `setValue` never marks a field dirty, so typing in the derived field
 * itself is what stops the auto-derivation - the caller passes that state
 * in via `targetIsDirty` (from react-hook-form's `dirtyFields`).
 *
 * Eliminates the previously copy-pasted:
 *   onChange: (e) => { if (!dirtyFields.slug) setValue("slug", deriveSlug(e.target.value)); }
 * duplicated across CreateOrgDialog, OnboardingForm and CreateProjectDialog.
 */
export function createDerivedFieldHandler<
  TFieldValues extends FieldValues,
  TTarget extends Path<TFieldValues>,
>(
  setValue: UseFormSetValue<TFieldValues>,
  targetIsDirty: boolean,
  targetField: TTarget,
  derive: (sourceValue: string) => PathValue<TFieldValues, TTarget>,
): (e: ChangeEvent<HTMLInputElement>) => void {
  return (e) => {
    if (!targetIsDirty) {
      setValue(targetField, derive(e.target.value));
    }
  };
}
