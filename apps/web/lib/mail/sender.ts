import "server-only";
import { createEmailSender, InMemoryEmailSender, type EmailSender } from "@taskflow/mail";
import { serverEnv } from "@/lib/env.server";
import { isE2ERun } from "@/lib/utils/local-database";

const globalForMail = globalThis as unknown as { inMemoryEmailSender?: InMemoryEmailSender };

/**
 * Test-only capture sender - must survive Next.js dev-mode route
 * recompilation. Each Route Handler is its own on-demand-entries bundle;
 * when Next.js evicts and recompiles one independently of another, a plain
 * module-level singleton silently becomes two different instances between
 * /api/auth/register and /api/test/last-email, so captured emails
 * "disappear" depending on which route was compiled last.
 *
 * Stashing it on globalThis - the exact same pattern already used for the
 * PrismaClient singleton (see packages/database/src/index.ts) - guarantees
 * one shared instance for the lifetime of the Node.js process regardless of
 * how many times individual route modules get re-evaluated.
 */
export const inMemoryEmailSender: InMemoryEmailSender =
  globalForMail.inMemoryEmailSender ?? new InMemoryEmailSender();
globalForMail.inMemoryEmailSender = inMemoryEmailSender;

// isE2ERun() - not just the ENABLE_TEST_ROUTES flag - see that function's
// docblock. Without the local-database half of that check, ENABLE_TEST_ROUTES
// leaking into a real deployment would silently redirect every real
// verification/password-reset email into this in-memory buffer instead of
// either sending it for real or failing loudly - the worst of both worlds.
// isE2ERun() requiring a local DB connection too means a leaked flag in a
// real deployment falls through to createEmailSender() below instead, which
// throws immediately in production if misconfigured (see its docblock).
const testRoutesEnabled = isE2ERun();

/**
 * App-wide EmailSender singleton.
 *
 * - E2E runs (ENABLE_TEST_ROUTES=true AND connected to a local database, set
 *   only by playwright.config.ts's webServer env): always the in-memory
 *   capture sender, regardless of RESEND_API_KEY - keeps the suite fast and
 *   independent of a real mailbox.
 * - Everything else: Resend vs. console fallback, see createEmailSender.
 */
export const emailSender: EmailSender = testRoutesEnabled
  ? inMemoryEmailSender
  : createEmailSender({
      resendApiKey: serverEnv.RESEND_API_KEY,
      from: serverEnv.EMAIL_FROM,
      isProduction: serverEnv.NODE_ENV === "production",
    });
