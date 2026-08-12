import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Deliberately not the `dotenv` package's own parse() - that's only a
 * dependency of apps/api, and this script runs from the repo root (via
 * `pnpm sync-env`), where pnpm's isolated node_modules wouldn't resolve it
 * without adding it as a root devDependency just for this. This repo's own
 * .env files are always flat `KEY=VALUE` lines (no multiline values), so a
 * minimal parser covers every real case here.
 */
function parseEnvFile(raw) {
  const result = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Turborepo's own guidance (and Next.js's/dotenv's own loading behavior)
 * is that a monorepo-root .env file is an anti-pattern: neither `tsx`
 * (apps/api's dotenv.config() call in src/main.ts, no explicit path) nor
 * Next.js (apps/web's built-in .env loading) reads a REPO-ROOT .env when
 * `pnpm dev`/`turbo run dev` runs each package's script with that
 * package's own directory as cwd - only `docker compose` genuinely reads
 * the root .env (Compose always resolves it relative to wherever `docker
 * compose` itself is invoked, per this repo's README, i.e. the repo root).
 *
 * So for the bare local-dev flow (not Docker), each package needs its OWN
 * `.env`/`.env.local` - but maintaining those by hand as 3 independent
 * copies of the root file is exactly how they drifted stale before this
 * script existed (an apps/web/.env.local with a `NEXT_PUBLIC_SOCKET_URL`
 * that no schema has read in a long time, missing `INTERNAL_API_SECRET`/
 * `TRUSTED_PROXY_HOPS`/etc. entirely).
 *
 * This script keeps the root `.env` as the SINGLE source of truth an
 * operator actually edits, and regenerates the 3 per-package files from it
 * - each with only the subset of keys that package's own Zod schema (or,
 * for apps/web, ALSO apps/api's schema - see the comment on WEB_KEYS below)
 * actually reads. Re-run after editing the root `.env`; the generated
 * files carry a header saying not to edit them directly for exactly that
 * reason.
 *
 * Run via `pnpm sync-env` (see README's "Getting started").
 */

const ROOT_ENV_PATH = path.resolve(import.meta.dirname, "..", ".env");

/** apps/api/src/config/env.ts's envSchema - every field it reads, required or optional. */
const API_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "API_PORT",
  "API_LOG_LEVEL",
  "WEB_ORIGIN",
  "NEXTAUTH_SECRET",
  "METRICS_TOKEN",
  "TRUSTED_PROXY_HOPS",
  "PASSWORD_CHANGED_AT_CACHE_TTL_MS",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "INTERNAL_API_SECRET",
];

/**
 * apps/web/lib/env.ts's own serverEnvSchema + publicEnvSchema fields.
 *
 * Deliberately does NOT include RESEND_API_KEY/EMAIL_FROM/API_PORT/
 * METRICS_TOKEN/WEB_ORIGIN/API_LOG_LEVEL even though apps/web's process
 * ALSO transitively runs apps/api's own envSchema parse (importing
 * @taskflow/api/trpc for the RSC in-process caller runs apps/api's env.ts
 * as a module-load side effect - see check-env-parity.mjs's docblock for
 * the same hazard under Docker). Every one of those apps/api-only fields
 * has a valid default, so omitting them here just means apps/web's
 * in-process view of apps/api's config uses apps/api's defaults - correct,
 * since apps/web never calls app.listen()/sends mail/etc. itself. Only
 * DATABASE_URL/NEXTAUTH_SECRET overlap for real (both schemas require them
 * unconditionally), which is why they appear in both lists here.
 *
 * Deliberately EXCLUDES COOKIE_DOMAIN even if the root .env has it set: that
 * field only makes sense when apps/api and apps/web are deployed on real
 * sibling subdomains of the SAME domain (see its own .env.example comment).
 * A root .env doubling as a reference for the user's own real deployment
 * would otherwise get its COOKIE_DOMAIN silently copied into local dev too,
 * where both apps run on bare `localhost` - NextAuth would then scope the
 * session cookie's Domain attribute to that unrelated real domain, which
 * the browser correctly refuses to store for `localhost` at all, breaking
 * login into an invisible failure (looks like it succeeds server-side, no
 * cookie ever lands, every subsequent navigation bounces back to /login).
 * Confirmed exactly this way while writing this script.
 */
const WEB_KEYS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "TRUSTED_PROXY_HOPS",
  "PASSWORD_CHANGED_AT_CACHE_TTL_MS",
  "INTERNAL_API_SECRET",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_WEB_URL",
];

/** packages/database/prisma.config.ts + the Prisma CLI's own .env loading - only ever this one var. */
const DATABASE_KEYS = ["DATABASE_URL"];

const TARGETS = [
  { relPath: "apps/api/.env", keys: API_KEYS },
  { relPath: "apps/web/.env.local", keys: WEB_KEYS },
  { relPath: "packages/database/.env", keys: DATABASE_KEYS },
];

function readRootEnv() {
  let raw;
  try {
    raw = readFileSync(ROOT_ENV_PATH, "utf-8");
  } catch {
    console.error(
      `sync-env: no root .env found at ${ROOT_ENV_PATH} - run \`cp .env.example .env\` and fill in real values first.`,
    );
    process.exit(1);
  }
  return parseEnvFile(raw);
}

function renderTarget(relPath, keys, rootEnv) {
  const lines = [
    "# AUTO-GENERATED by `pnpm sync-env` from the repo root's .env - DO NOT EDIT DIRECTLY.",
    "# Edit the root .env instead, then re-run `pnpm sync-env`.",
    "#",
    "# Why this file exists at all (and isn't just the root .env): neither `tsx`",
    "# (apps/api) nor Next.js (apps/web) reads a repo-root .env when run via",
    "# `pnpm dev`/`turbo run dev` - each workspace script runs with that",
    "# package's own directory as cwd. Only `docker compose` reads the root",
    "# .env directly. See scripts/sync-env.mjs's own docblock.",
    "",
  ];

  for (const key of keys) {
    if (!(key in rootEnv)) continue;
    lines.push(`${key}=${rootEnv[key]}`);
  }

  writeFileSync(path.resolve(import.meta.dirname, "..", relPath), `${lines.join("\n")}\n`);
}

const rootEnv = readRootEnv();

for (const { relPath, keys } of TARGETS) {
  renderTarget(relPath, keys, rootEnv);
}

console.log(`sync-env: regenerated ${TARGETS.map((t) => t.relPath).join(", ")} from ${ROOT_ENV_PATH}.`);
