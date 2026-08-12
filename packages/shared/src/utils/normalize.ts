import { z } from "zod";

/**
 * Collapses internal whitespace and trims. "  hello   world " -> "hello world".
 */
export function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Zod string for a human-facing display name: validates length, then trims,
 * collapses whitespace and title-cases at the validation boundary so BOTH the
 * API and the web app store the same normalized value.
 */
export function nameField(
  min: number,
  max: number,
): z.ZodPipe<z.ZodString, z.ZodTransform<string, string>> {
  return z
    .string()
    .trim()
    .min(min, { error: `Must be at least ${String(min)} characters.` })
    .max(max, { error: `Must be at most ${String(max)} characters.` })
    .transform(collapseSpaces);
}

/**
 * Zod string for an email address: trims and lowercases BEFORE validating
 * the format (via `.pipe()`, not chained after `z.email()`), so
 * whitespace-padded input from browser autofill is tolerated rather than
 * rejected, and the parsed value is always lowercase - what
 * `@@unique([orgId, email])`-style constraints and case-insensitive lookups
 * assume everywhere they're used.
 */
export function emailField(): z.ZodPipe<z.ZodString, z.ZodEmail> {
  return z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Please enter a valid email address." }));
}
