import { execSync } from "node:child_process";

// env.ts's module body runs the real Zod parse on import and exits the
// process on failure - these placeholders only need to satisfy the schema
// well enough to import envSchema itself, they're never actually used.
process.env.DATABASE_URL ??= "postgresql://check-env-parity:placeholder@localhost:5432/placeholder";
process.env.NEXTAUTH_SECRET ??= "check-env-parity-placeholder-secret";
// apps/web's own serverEnvSchema requires NEXTAUTH_URL unconditionally
// (lib/env.ts) - same placeholder-only-to-satisfy-import rationale as above.
process.env.NEXTAUTH_URL ??= "http://check-env-parity.invalid";

const { envSchema } = await import("../apps/api/src/config/env.ts");
const { serverEnvSchema: webServerEnvSchema } = await import("../apps/web/lib/env.ts");

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
 * A THIRD, separate check runs the same structural computation against
 * apps/web's OWN `serverEnvSchema` (lib/env.ts) against just the "web"
 * service - apps/api's schema doesn't cover apps/web-only required fields
 * (e.g. NEXTAUTH_URL), so without this a new required field added there
 * could be silently missing from docker-compose.yml with nothing catching
 * it here (this exact gap - one earlier version of this script only ever
 * imported apps/api's envSchema - flagged in a later env-parity audit).
 *
 * Also asserts ENABLE_TEST_ROUTES, E2E_TEST_SECRET, and NEXT_PUBLIC_E2E_TEST_SECRET
 * are never set on api/web/migrate - the alternative to this being enforced
 * was a comment-only convention in .env.example (and, for the latter two,
 * in env.ts's own field comments), which is exactly the kind of thing this
 * script exists to replace with a real check. NEXT_PUBLIC_E2E_TEST_SECRET is
 * the sharper of the three: it's inlined into apps/web's client JS bundle at
 * build time, so a leaked value isn't just a misconfigured server - it's
 * permanently baked into whatever gets shipped from that build.
 *
 * Run via `pnpm check:env-parity` (wired into CI - see .github/workflows).
 */

const TEST_ONLY_ENV_VARS = ["ENABLE_TEST_ROUTES", "E2E_TEST_SECRET", "NEXT_PUBLIC_E2E_TEST_SECRET"];

/**
 * Required in production by env.ts's `superRefine`, not by the object
 * shape itself - both fields are `.optional()` at the shape level (only
 * required outside development, conditional on NODE_ENV/isE2ERun()), so
 * `requiredApiKeys()`'s `!fieldSchema.isOptional()` filter can never see
 * them. Listed here by hand so a future removal from docker-compose.yml
 * still gets caught instead of only surfacing as a runtime crash the next
 * time someone runs `docker compose up` against a production-like config.
 */
const PRODUCTION_ONLY_REQUIRED_KEYS = ["INTERNAL_API_SECRET", "RESEND_API_KEY"];

function requiredApiKeys() {
  const shape = envSchema.shape;
  // .isOptional() is false only for fields with neither .optional() nor
  // .default() - i.e. the ones envSchema.safeParse({}) would actually fail
  // without (verified against the real schema: NODE_ENV/API_PORT/etc. all
  // report isOptional() === true because a .default() makes them optional
  // for input purposes, same as METRICS_TOKEN's explicit .optional()).
  const shapeRequired = Object.entries(shape)
    .filter(([, fieldSchema]) => !fieldSchema.isOptional())
    .map(([key]) => key);
  return [...new Set([...shapeRequired, ...PRODUCTION_ONLY_REQUIRED_KEYS])];
}

/**
 * Same structural computation as requiredApiKeys(), against apps/web's OWN
 * schema instead. No PRODUCTION_ONLY_REQUIRED_KEYS-style hand-maintained
 * list here: apps/web's serverEnvSchema has no superRefine of its own that
 * conditionally requires an otherwise-.optional() field (INTERNAL_API_SECRET
 * is the one field that comes close, but it's already covered structurally
 * since it's REQUIRED unconditionally on apps/api's side, checked above).
 */
function requiredWebKeys() {
  const shape = webServerEnvSchema.shape;
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
const requiredWeb = requiredWebKeys();
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

{
  const keys = serviceEnvKeys(config, "web");
  const missing = requiredWeb.filter((key) => !keys.has(key));

  if (missing.length > 0) {
    failed = true;
    console.error(
      `docker-compose.yml's "web" service is missing env var(s) required by apps/web's own schema: ${missing.join(", ")}`,
    );
  }
}

for (const serviceName of ["api", "web", "migrate"]) {
  const keys = serviceEnvKeys(config, serviceName);
  for (const testOnlyVar of TEST_ONLY_ENV_VARS) {
    if (keys.has(testOnlyVar)) {
      failed = true;
      console.error(
        `docker-compose.yml's "${serviceName}" service sets ${testOnlyVar} - this is Playwright-only ` +
          "(see playwright.config.ts) and must never be set outside its own E2E run.",
      );
    }
  }
}

if (failed) process.exit(1);

console.log(
  `OK - api and web both cover all ${required.length} required apps/api env var(s) ` +
    `(${required.join(", ")}); web also covers its own ${requiredWeb.length} required var(s) ` +
    `(${requiredWeb.join(", ")}); and ${TEST_ONLY_ENV_VARS.join(", ")} are unset everywhere.`,
);
