/**
 * Best-effort derivations for identifier fields so users don't have to
 * invent slugs/keys by hand. Outputs match slugSchema / projectKeySchema
 * shapes; edge cases (too-short names) are left for the user + zod.
 */

/** "My Web Project" -> "my-web-project" */
export function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** "My Web Project" -> "MWP"; "Backend" -> "BACK" */
export function deriveProjectKey(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

  const rawKey =
    words.length >= 2
      ? words.map((w) => w.charAt(0)).join("")
      : (words[0] ?? "").replace(/^[0-9]+/, "").slice(0, 4);

  // Keys must start with a letter (see projectKeySchema)
  return rawKey.slice(0, 10);
}
