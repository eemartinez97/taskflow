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
