import { execSync } from "node:child_process";

// env.ts's module body runs the real Zod parse on import and exits the
// process on failure - these placeholders only need to satisfy the schema
// well enough to import envSchema itself, they're never actually used.
process.env.DATABASE_URL ??= "postgresql://check-env-parity:placeholder@localhost:5432/placeholder";
process.env.NEXTAUTH_SECRET ??= "check-env-parity-placeholder-secret";

const { envSchema } = await import("../apps/api/src/config/env.ts");

/**
 * Two checks against docker-compose.yml's resolved config, both about
 * apps/api's required env vars:
 *
 * 1. "api" service itself has them - the obvious case (its own container
 *    would just crash-loop otherwise, which is loud, but check it anyway so
 *    this script is a complete gate on its own).
 * 2. "web" service ALSO has them - the non-obvious case pre-mortem review
 *    flagged: apps/web imports @taskflow/api/trpc (RSC caller), whose module
 *    graph runs apps/api's own env.ts at import time - a `process.exit(1)`
 *    if that Zod schema fails. Adding a new REQUIRED key to
 *    apps/api/src/config/env.ts without also adding it to the "web" service
 *    would silently break `docker compose up` the next time someone does
 *    that, even though apps/api's own service is fine.
 *
 * Also asserts ENABLE_TEST_ROUTES is never set on api/web/migrate - the
 * alternative to this being enforced was a comment-only convention in
 * .env.example, which is exactly the kind of thing this script exists to
 * replace with a real check.
 *
 * Run via `pnpm check:env-parity` (wired into CI - see .github/workflows).
 */

function requiredApiKeys() {
  const shape = envSchema.shape;
  // .isOptional() is false only for fields with neither .optional() nor
  // .default() - i.e. the ones envSchema.safeParse({}) would actually fail
  // without (verified against the real schema: NODE_ENV/API_PORT/etc. all
  // report isOptional() === true because a .default() makes them optional
  // for input purposes, same as METRICS_TOKEN's explicit .optional()).
  return Object.entries(shape)
    .filter(([, fieldSchema]) => !fieldSchema.isOptional())
    .map(([key]) => key);
}

function resolvedComposeConfig() {
  const raw = execSync("docker compose config --format json", { encoding: "utf-8" });
  return JSON.parse(raw);
}

function serviceEnvKeys(config, serviceName) {
  return new Set(Object.keys(config.services[serviceName]?.environment ?? {}));
}

const required = requiredApiKeys();
const config = resolvedComposeConfig();

let failed = false;

for (const serviceName of ["api", "web"]) {
  const keys = serviceEnvKeys(config, serviceName);
  const missing = required.filter((key) => !keys.has(key));

  if (missing.length > 0) {
    failed = true;
    console.error(
      `docker-compose.yml's "${serviceName}" service is missing env var(s) required by apps/api's schema: ${missing.join(", ")}`,
    );
  }
}

for (const serviceName of ["api", "web", "migrate"]) {
  const keys = serviceEnvKeys(config, serviceName);
  if (keys.has("ENABLE_TEST_ROUTES")) {
    failed = true;
    console.error(
      `docker-compose.yml's "${serviceName}" service sets ENABLE_TEST_ROUTES - this exposes apps/web's E2E-only /api/test/* routes and must never be set outside Playwright's own run.`,
    );
  }
}

if (failed) process.exit(1);

console.log(
  `OK - api and web both cover all ${required.length} required apps/api env var(s) (${required.join(", ")}), and ENABLE_TEST_ROUTES is unset everywhere.`,
);
