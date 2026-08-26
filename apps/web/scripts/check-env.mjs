import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { fullEnvSchema } from "../lib/env.ts";

/**
 * Runs BEFORE `next build` (see package.json's "build" script) so a missing
 * required env var (e.g. INTERNAL_API_SECRET, added by the auth-
 * consolidation epic) fails with a plain, readable Zod error instead of
 * Next.js's own build-time page-data-collection error, which swallows the
 * real cause and only reports "Failed to collect page data for /some/route"
 * - the route that happens to import env.server.ts first, not the actual
 * missing variable. Deployment platforms (Vercel, Railway, etc.) manage env
 * vars in their own dashboard, not from this repo, so a newly-added
 * required var is exactly the kind of thing that's easy to forget there.
 *
 * Unlike `next build`/`next start`, this is a plain tsx script - Next.js's
 * own automatic .env.local loading does not apply to it, and it never had
 * any dotenv loading of its own. That gap is invisible whenever the calling
 * shell already exports these vars (CI sets them directly in the workflow's
 * `env:` block - see .github/workflows/web.yml), which is exactly why it
 * went unnoticed locally: `pnpm --filter @taskflow/web build` (and anything
 * that runs it, e.g. Playwright's e2e webServer command) only ever worked
 * for whoever happened to have DATABASE_URL/NEXTAUTH_SECRET/NEXTAUTH_URL
 * already exported by hand. `dotenv.config()` fixes that for local runs
 * without touching CI: `apps/web/.env.local` is gitignored and never exists
 * in CI, so this call finds nothing there and silently no-ops, leaving the
 * workflow's own `env:` values untouched. Deliberately `.env.local`, not the
 * repo-root `.env` - the root file carries deployment-only values like
 * COOKIE_DOMAIN that break a local build (see the project's local-env memo).
 * `quiet: true` matches apps/api/src/main.ts's own dotenv.config() call -
 * same reason, suppress the startup log line dotenv 17 prints by default.
 */
dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env.local"),
  quiet: true,
});

/**
 * Validates fullEnvSchema (server + NEXT_PUBLIC_* together) since both
 * halves matter for a real build - see env.ts's own docblock for why they
 * stay two separate schemas at runtime (server secrets must never reach
 * publicEnvSchema/the client bundle) even though this check runs both.
 */
const parsed = fullEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("\n✖ apps/web: missing/invalid required environment variable(s) for build:\n");
  console.error(z.prettifyError(parsed.error));
  console.error(
    "\nSee .env.example and apps/web/lib/env.ts. On a deployment platform (Vercel, " +
      "Railway, etc.), these are set in that platform's own project settings, not read " +
      "from this repo.\n",
  );
  process.exit(1);
}
