/**
 * True for Resend's own sandbox/test sending address (onboarding@resend.dev,
 * bare or in "Name <email>" form) - Resend restricts it to only ever deliver
 * to the account owner, never a real recipient.
 *
 * Shared between packages/mail's createEmailSender (which throws on it in
 * production - the actual enforcement boundary) and apps/web's server env
 * schema (which rejects it at env-validation time, so a misconfigured
 * deploy fails as early as possible, before the factory ever runs). Kept as
 * one regex here instead of copied into both call sites so they can never
 * silently drift apart.
 */
export function isResendSandboxAddress(from: string): boolean {
  return /@resend\.dev>?$/i.test(from);
}
