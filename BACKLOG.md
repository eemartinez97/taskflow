# Backlog

Non-blocking items found during the auth refactor review. Nothing here is a
security hole or a broken flow, just stuff that should get done eventually.

- [ ] Send a "your password was changed" email on successful reset
      (`apps/web/app/api/auth/reset-password/route.ts` sends nothing today).
- [x] Add a GitHub Actions pipeline (lint, typecheck, test, build). Done -
      `.github/workflows/ci.yml` - lint/typecheck/test + a docker-build job
      that brings up the full compose stack and smoke-tests it, + gitleaks.
- [ ] Log session revocations with a reason (`getSessionUser` in
      `apps/api/src/utils/auth.ts` just returns null silently when a session
      is revoked due to a password change).
- [ ] Update README: `packages/mail` isn't listed in the monorepo table, and
      the "Getting started" script names don't match `package.json`
      (`migrate:deploy`/`seed` vs the actual `db:migrate:deploy`/`db:seed`).
- [ ] Document `ENABLE_TEST_ROUTES` and `E2E_TEST_SECRET` in `.env.example`
      (even just as "leave unset in production") - they gate the `/api/test/*`
      routes and should be discoverable.
- [ ] `AuthToken` rows for verified users who never click their reset/verify
      link never get cleaned up. Only abandoned (unverified) registrations
      get swept right now.
- [ ] **Revisit the password-change session-revocation window.** A session
      cookie issued before a password reset stays valid for up to
      `PASSWORD_CHANGED_AT_CACHE_TTL_MS` (60s by default in every real
      deployment - see `apps/web/lib/auth/session-revocation.ts` and
      `apps/api/src/utils/auth.ts`, each with its own in-process cache
      instance) after the reset, since the revocation check is cached
      instead of hitting the DB on every request. Deliberate perf/security
      trade-off, not a bug - but worth reconsidering if the threat model
      changes (e.g. "attacker has a stolen session cookie and the user
      resets their password specifically to cut them off" wants that cut
      to be immediate, not up-to-60s-later). Options if this needs to
      change: lower the TTL (cheap, still a window, just smaller), or move
      to real-time invalidation (e.g. a revoked-token/session table checked
      on every request - no cache, no window, but back to a DB read per
      request on the hot path this caching was added to avoid). Related:
      the "log session revocations with a reason" item above.

## From the auth-refactor code review (2026-08-07)

Non-security findings from the same review pass that produced the two auth
rate-limit/timing fixes above. Nothing blocking, but worth cleaning up.

- [ ] `apps/api/scripts/build.mjs` builds with esbuild (bundling, strips
      types) instead of the old `tsc --project tsconfig.build.json`, so
      `pnpm --filter @taskflow/api build` no longer type-checks on its own.
      CI is safe (`docker-build` depends on a separate `pnpm typecheck` job),
      but a local/manual `docker compose up --build` skips that check and can
      ship a type error silently. Either run `tsc --noEmit` as a pre-build
      step in the script, or document that `build` alone isn't a type-check.
- [ ] `docker-compose.yml`'s `nginx` service has no `healthcheck` (unlike
      `postgres`/`api`/`web`), so `.github/workflows/ci.yml`'s wait-loop can't
      see nginx-specific startup failures - it only catches them later via the
      generic `curl -f http://localhost/healthz` smoke test, with less
      diagnostic clarity. Add a healthcheck (e.g. `curl -f` against nginx's
      own health endpoint or a static path).
- [ ] `packages/shared/src/utils/password-changed-at-cache.ts`'s cache `Map`
      has no TTL sweep or max-size cap, unlike the sibling
      `createRateLimiter` in the same file's neighborhood
      (`packages/shared/src/utils/rate-limit.ts`, which has `sweepExpired` +
      `maxTrackedKeys`). Entries are added per distinct user ever
      authenticated and never evicted, including for deleted/inactive
      accounts - slow unbounded memory growth over months of uptime on a
      long-running process with a large user base. Low priority until user
      count is large enough to matter.
- [ ] `PASSWORD_CHANGED_AT_CACHE_TTL_MS` and `TRUSTED_PROXY_HOPS` are each
      hand-duplicated as separate Zod fields in `apps/api/src/config/env.ts`
      and `apps/web/lib/env.ts`, kept in sync only by comments asking future
      editors not to drift them. Extract a shared Zod fragment (e.g. in
      `packages/shared`) so a bounds/default change can't be applied to only
      one side.
- [ ] `apps/api/src/middleware/rate-limit.ts` exports `createRateLimiter()`
      (an `express-rate-limit` HTTP middleware factory) - same exported name
      as the unrelated generic in-memory sliding-window limiter in
      `packages/shared/src/utils/rate-limit.ts` (used by
      `apps/api/src/socket/rate-limit.ts`). Rename one of the two to avoid
      wrong-import mistakes (IDE auto-import, search-and-replace) when wiring
      up a new route or socket handler.
- [ ] `packages/database/src/scripts/cleanup-abandoned-registrations.ts` and
      `cleanup-expired-rate-limits.ts` duplicate an identical ~15-line CLI
      bootstrap block (dotenv config, PrismaPg adapter + client construction,
      try/finally disconnect, `import.meta.url` entrypoint guard,
      `process.exit(1)` on error). Extract a shared runner helper before the
      already-planned third cleanup job (expired `AuthToken` rows, see the
      "never get cleaned up" item above) copies it a third time.
- [ ] `apps/web/tests/e2e/auth.spec.ts`'s session-revocation-TTL test lost its
      `test.slow()` call, so the real wait (`cacheTtlMs + 1000`, falling back
      to a real 61s if `PASSWORD_CHANGED_AT_CACHE_TTL_MS` isn't propagated to
      the test worker) now has no extended timeout margin against the file's
      default 30s. Not currently failing (the env var does propagate today),
      but fragile if `playwright.config.ts` ever changes how it forwards that
      var. Re-add `test.slow()` on that test.

## Scale beyond a single instance

The current docker-compose stack works for local dev/demo but was never designed
to run more than one replica of `api`. None of these matter until someone
actually tries to scale `api` horizontally - flagged here so it isn't
rediscovered the hard way in production.

- [ ] Rate limiting is in-memory (`express-rate-limit`'s default `MemoryStore`,
      see `apps/api/src/middleware/rate-limit.ts`) - each `api` replica keeps
      its own counter. With 2+ replicas behind nginx, the limit stops meaning
      anything (an attacker just gets N replicas' worth of budget). Needs
      `rate-limit-redis` (the code comment already says so) before scaling `api`.
- [ ] Socket.IO has no Redis adapter (`apps/api/src/socket/server.ts`). A user
      connected to replica A never sees a broadcast that originated on replica
      B - live cursors/presence would silently break for part of the user base
      the moment `api` runs more than one instance. Needs `@socket.io/redis-adapter`.
- [ ] `infrastructure/nginx/nginx.conf`'s upstreams are single fixed backends
      (`server api:8000`, `server web:3000`) - no load balancing, no multiple
      replicas, no health-aware routing. Fine for one instance each; would need
      real upstream pools (`least_conn` or similar) to scale.
- [ ] Each `api`/`web` instance opens its own Prisma/pg connection pool directly
      against Postgres - no pgbouncer, no read replicas. More replicas means
      more connections, not more query capacity; Postgres connection limits
      would be the first thing to fall over under real horizontal scaling.

## Observability

- [ ] `docker-compose.yml` exposes `/metrics` (Prometheus format, see
      `apps/api/src/metrics/`) but nothing scrapes or displays it. Add
      `prometheus` + `grafana` services to the compose stack for an actual
      dashboard instead of raw `curl`.
