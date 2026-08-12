import { createEmailSenderFromEnv, InMemoryEmailSender, type EmailSender } from "@taskflow/mail";
import { env } from "../config/env";
import { isE2ERun } from "../utils/e2e";

let cachedSender: EmailSender | undefined;
let cachedInMemorySender: InMemoryEmailSender | undefined;

/**
 * Test-only capture sender - a single process-lifetime instance (unlike
 * apps/web's equivalent, apps/api has no per-route module re-evaluation to
 * survive, so a plain module-scope singleton is enough). Exposed on its own
 * so the E2E test router (src/routes/test.ts) can read back what was sent
 * without going through the general EmailSender interface.
 */
export function inMemoryEmailSender(): InMemoryEmailSender {
  cachedInMemorySender ??= new InMemoryEmailSender();
  return cachedInMemorySender;
}

/**
 * App-wide EmailSender singleton - lazy and memoized, NOT constructed at
 * module scope.
 *
 * apps/web imports `@taskflow/api/trpc` for its RSC caller
 * (lib/trpc/server.ts), which evaluates this whole module graph at import
 * time. createEmailSenderFromEnv throws in production without
 * RESEND_API_KEY - a module-scope construction would crash apps/web's boot
 * the instant it imports the router, in a process that may never send an
 * email at all. Deferring construction to first call keeps that failure
 * scoped to apps/api's own process, on the first request that actually
 * needs to send mail.
 *
 * - E2E runs (ENABLE_TEST_ROUTES=true AND connected to a local database):
 *   always the in-memory capture sender, regardless of RESEND_API_KEY - same
 *   rule as apps/web's lib/mail/sender.ts.
 * - Everything else: Resend vs. console fallback, see createEmailSenderFromEnv.
 */
export function getEmailSender(): EmailSender {
  if (isE2ERun()) return inMemoryEmailSender();
  cachedSender ??= createEmailSenderFromEnv({
    RESEND_API_KEY: env.RESEND_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM,
    isProduction: env.NODE_ENV === "production",
  });
  return cachedSender;
}

/** Test-only: clears both memoized senders so env-dependent tests get a fresh one. */
export function resetEmailSender(): void {
  cachedSender = undefined;
  cachedInMemorySender = undefined;
}
