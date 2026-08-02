/**
 * User display helpers
 */

interface UserDisplayable {
  name?: string | null;
  email?: string | null;
}

/**
 * Returns the user's display name, falling back to email.
 * Used wherever we show a user's identity in the UI.
 */
export function displayName(user: UserDisplayable): string {
  return user.name ?? user.email ?? "User";
}

/**
 * Returns up to two uppercase initials for an avatar placeholder.
 * e.g. "Erick Monjaras" -> "EM", "sophia@example.com" -> "S"
 */
export function userInitials(user: UserDisplayable): string {
  if (user.name) {
    return user.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  if (user.email) {
    /* v8 ignore start */
    // A non-empty string always has index 0 defined; kept as a defensive
    // fallback only, unreachable in practice.
    return user.email[0]?.toUpperCase() ?? "??";
    /* v8 ignore stop */
  }

  return "??";
}
