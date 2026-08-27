# Backlog

Non-blocking items found during the auth refactor review. Nothing here is a
security hole or a broken flow, just stuff that should get done eventually.

## Auth consolidation + org invitations (planned in two epics)

Trigger was investigating org invitations: `orgs.inviteMember` created
`Membership` rows immediately with no `Invitation` table, no consent, no
email — and nothing sends invitation email anyway, since `apps/api` had no
`@taskflow/mail` dependency at all. Fixing invitations properly needed
`apps/api` to own the whole unauthenticated auth domain first (registration,
verification, password reset, mail), so exactly one process ever sends
email and invitations become a normal feature there instead of splitting
create-then-send across a network hop.

- [x] **Epic A — auth domain moved into `apps/api`.** Registration, email
      verification, password reset, and credential checking are now public
      (and one internal) tRPC procedures in `apps/api/src/modules/auth/`,
      not Next.js Route Handlers. `apps/web` is UI-only for auth. Side
      effects: login is rate-limited for the first time
      (`auth.verifyCredentials`, gated by a new `internalProcedure` +
      `INTERNAL_API_SECRET`), the E2E test routes (`/api/test/*`) and mail
      sender moved to `apps/api` alongside each other, and
      `CLAUDE.md`'s "Auth flow specifics" section was rewritten to match.
      See `apps/api/src/modules/auth/`, `apps/web/lib/trpc/http-server.ts`.
- [x] **Epic B — org invitations**, on top of Epic A. New `Invitation`
      model (`PENDING`/`ACCEPTED`/`DECLINED`/`REVOKED`, `role <> 'OWNER'`
      CHECK, `@@unique([orgId, email])` for atomic re-invite),
      `apps/api/src/modules/invitations/` (create/listForOrg/revoke/resend/
      listMine/getByToken/getByTokenPublic/accept/decline, all IDOR-guarded
      via `assertInvitationInOrg`), `Membership` created only on accept
      (`acceptInvitationTx`'s conditional `updateMany`, race-safe under
      concurrent accepts), `/organizations/[orgId]` route with a real
      Members + Invitations UI (replacing `/team`, kept as a redirect for
      old links/notifications), unregistered-invitee signup via
      `/register?invite=<token>` (prefilled read-only email), inline
      accept/decline from the notifications panel and a pending-invitations
      card, and full E2E coverage (`tests/e2e/invitations.spec.ts`) reading
      the real invite email through `/api/test/last-email`. `orgs.inviteMember`
      is gone (was the trigger for this whole epic - see above); `Membership`
      is now only ever created through `invitations.accept`. The
      pending-invitations card also shows each invite's expiry date, so an
      invitee can see they're on a clock before it lapses.
- [x] **Stale invitation purge**, the epic's optional follow-up.
      `packages/database/src/scripts/cleanup-stale-invitations.ts` deletes
      `PENDING` `Invitation` rows expired more than
      `STALE_INVITATION_GRACE_DAYS` (30 days) ago - `DECLINED`/`REVOKED`/
      `ACCEPTED` rows are left alone as resolved history. Wired into
      `.github/workflows/cleanup-cron.yml` alongside the other two daily
      cleanup jobs.

- [ ] **Known gotcha: repeated local E2E runs can trip the shared login
      rate limiter and cause flaky `auth.spec.ts` failures** (a login stuck
      on `/login`, `waitForURL(/\/projects/)` timing out - `verifyCredentials`
      returned `null` because `checkLoginIpRateLimit` actually limited it).
      Confirmed by querying `auth."RateLimitBucket"` directly after a flaky
      run: `login-ip:::1` had `count = 38` against `LOGIN_IP_RATE_LIMIT = 20`
      (`apps/api/src/modules/auth/rate-limit.ts`) - every local Playwright
      request shares one IP (`::1`), so this bucket is cumulative across
      however many `playwright test` invocations happen inside the same
      15-minute window, not just one run. The bypass itself
      (`isAuthorizedE2ERequest`, gated on `ENABLE_TEST_ROUTES` + a local
      `DATABASE_URL` + a matching `x-e2e-secret` header) was verified
      working correctly in an isolated run (added a temporary debug log,
      confirmed apps/web's `x-e2e-secret` header reaches apps/api and
      matches on every login call, zero real bucket writes) - the 38-count
      row was already outside its window (harmless) by the time this was
      investigated, so the exact run that produced it wasn't caught live.
      Likely cause: manual/ad-hoc testing against the same local Postgres
      before the bypass was fully wired up, or a `playwright test` run
      whose webServer didn't have `E2E_TEST_SECRET`/`ENABLE_TEST_ROUTES`
      set (e.g. `reuseExistingServer` picking up a stale process, or the
      server started outside `playwright.config.ts`). `RateLimitBucket`
      rows are never cleared mid-session (only the daily cron, and only
      once actually expired) - see also `/api/test/reset`'s own docblock
      for the identical caveat on the auth (register/reset) buckets.
      Deliberately NOT raising `LOGIN_IP_RATE_LIMIT`/`LOGIN_EMAIL_RATE_LIMIT`
      to paper over this - the bypass is the correct fix path when it's
      actually engaged; if this recurs, check first whether the webServer
      that ran actually had a fresh, matching `E2E_TEST_SECRET` before
      touching the limit values.

- [ ] **`apps/api/src/config/env.ts`'s validation is eager (runs at module
      import time via a top-level `parseEnv(process.env)`, `process.exit(1)`
      on failure), unlike `apps/api/src/mail/sender.ts`'s sender itself,
      which is deliberately lazy/memoized for exactly this reason - see that
      file's own docblock: `apps/web`'s RSC caller
      (`apps/web/lib/trpc/server.ts`) does `createAppRouter(noOpIo)` at ITS
      OWN module scope, which imports apps/api's entire router graph
      (auth/orgs/invitations/etc. routers -> their services -> `config/env.ts`)
      into apps/web's build/runtime, even though the `noOpIo` caller only
      ever runs queries and never sends mail. Only half the problem got
      lazy-fixed: the sender construction is deferred, but `config/env.ts`
      still eagerly validates EVERY field - including `RESEND_API_KEY`/
      `EMAIL_FROM`, which `noOpIo` never needs - the moment the module loads.
      Bit us for real: a Vercel deploy of `apps/web` failed on
      `RESEND_API_KEY is required in production` (apps/api's own error,
      surfacing from inside apps/web's build) because Vercel's project only
      had apps/web's OWN required vars configured, not apps/api's full set -
      an easy thing to forget since `apps/web/lib/env.ts` (the schema you'd
      actually check when provisioning `web`) doesn't even mention
      `RESEND_API_KEY` anymore post auth-consolidation. Fix: make
      `config/env.ts` validate lazily too (e.g. a `Proxy`-backed `env` that
      only parses - and only enforces the FULL schema - on first property
      access, or split the schema so query-path-only consumers like
      `noOpIo` only need the subset `createAppRouter` structurally requires
      to build the router, not fields no code path it can reach ever
      reads). Not urgent by itself - see `apps/web/scripts/check-env.mjs`
      and the deploy guide for the immediate fix (add apps/api's required
      vars to Vercel too) - but every future required var added anywhere in
      apps/api's dependency graph will silently become a required var for
      `apps/web`'s build too, however unrelated, until this is fixed.

- [ ] Send a "your password was changed" email on successful reset
      (`apps/api/src/modules/auth/service.ts`'s `resetPassword` sends nothing today).
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
- [x] **`pnpm --filter @taskflow/api dev` (`tsx watch`) silently broke every
      real email send - now fixed for real.** Found while building Epic B's
      E2E coverage: `tsx` resolves exactly ONE tsconfig per process (from
      `--tsconfig`, or discovered from cwd) and only applies its `jsx`
      compilerOption to files matched by THAT tsconfig's own `include` - it
      does not walk up to each file's nearest tsconfig.json the way `tsc`
      does. `apps/api/tsconfig.json` has no reason to include anything
      outside `src`/`tests`, so `packages/mail`'s `.tsx` email templates fell
      outside it, silently got esbuild's classic JSX transform (bare
      `React.createElement`, no import) instead of the automatic runtime, and
      `sendVerificationEmail`/`sendPasswordResetEmail`/`sendOrgInviteEmail`/
      etc. all crashed at call time with `ReferenceError: React is not
defined`. Invisible in `pnpm test` (Vitest's own esbuild pipeline
      resolves tsconfig correctly) and in the production build
      (`apps/api/scripts/build.mjs`'s explicit `jsx: "automatic"` esbuild
      option, a separate but related fix for the equivalent limitation in
      esbuild's own bundler). Real fix: `apps/api/tsconfig.dev.json` (used
      only by the `dev` script, via `tsx watch --tsconfig tsconfig.dev.json`)
      widens `include` to also cover `packages/mail/src` and sets
      `"jsx": "react-jsx"` - see that file's own docblock. Verified by
      booting `pnpm --filter @taskflow/api dev` and both registering a real
      user (200, real verification email sent) and calling
      `sendOrgInviteEmail` directly (the exact file/line that used to crash).
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
- [x] `packages/database/src/scripts/cleanup-abandoned-registrations.ts` and
      `cleanup-expired-rate-limits.ts` duplicated an identical ~15-line CLI
      bootstrap block. Extracted into `run-cleanup.ts`'s `runCleanupCli()`
      when the stale-invitations cleanup job (see the invitations epic above)
      became the third copy of it - each script is now just its
      `cleanupXxx(db, ...)` pure function plus a one-line entrypoint guard.
- [ ] **Revisit `apps/web/lib/http/client-ip.ts`'s hand-rolled XFF hop-count
      parsing vs. apps/api's Express `trust proxy` (`proxy-addr`/`forwarded`).**
      Both implement the identical "trust N hops" algorithm independently.
      Investigated unifying them and concluded it's not a safe mechanical
      fix: `forwarded`'s address list construction requires
      `req.socket.remoteAddress` (the raw TCP peer) as its first entry, and
      `client-ip.ts`'s caller (`auth.ts`'s NextAuth `authorize()`) only has
      a plain object with headers - no underlying socket at all - so those
      packages cannot be dropped in without either silently misbehaving
      (no real socket to seed the address list with) or threading a raw
      socket through NextAuth's callback signature, which is a bigger
      change than a cleanup pass justifies. If this gets revisited: check
      whether Next.js's Route Handler / Server Action runtime ever exposes
      a reliable raw socket reference across all deployment targets this
      project supports - if so, that access point (not this file's current
      caller) is where real reuse becomes possible. Until then, keep the
      two implementations' _algorithm_ in sync by comment (see both files'
      docblocks), not by shared code.
- [ ] **Revisit the auth rate limiter's relationship to `packages/shared`'s
      `RateLimiter`.** `apps/api/src/modules/auth/rate-limit.ts`'s
      Postgres-backed `checkRateLimitBucket`/`releaseRateLimitBucket` (added
      for register/password-reset/login) reinvent the exact same
      `windowToken`/`release` "refundable sliding window" contract already
      defined as the `RateLimiter` interface in
      `packages/shared/src/utils/rate-limit.ts`, as a fully independent,
      parallel implementation with no shared interface. Investigated
      unifying them directly and concluded it's not a safe mechanical fix:
      `RateLimiter` is deliberately fully SYNCHRONOUS (built for the
      in-memory socket-presence limiter's hot path -
      `apps/api/src/socket/rate-limit.ts` /
      `apps/api/src/middleware/rate-limit.ts` - see that file's own
      perf-motivated docblock), while the Postgres-backed one is
      necessarily ASYNCHRONOUS (every operation is a DB round-trip).
      Sharing one interface would mean making `RateLimiter` async and
      updating every socket-layer consumer to `await` it - a cross-cutting
      change to already-correct, performance-sensitive code, not something
      to do opportunistically alongside an auth bugfix pass. If/when this
      gets revisited: the honest options are (a) a proper `RateLimiter`
      variant/generic that supports both sync and async backends
      (`Promise<T> | T` return types, or two named interfaces sharing a
      spec), designed deliberately rather than retrofitted, or (b) accept
      the duplication permanently and just keep the two implementations'
      _semantics_ (refundable release, window-token staleness check) in
      sync by comment, which is the status quo today.
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

## Product features

- [ ] **Multi-language support (i18n).** No i18n library or translated
      strings exist anywhere in `apps/web` today - every UI string is
      hardcoded English JSX. Would need a library (e.g. `next-intl`) wired
      into the App Router, a message-catalog structure, and every existing
      component migrated off literal strings.
- [ ] **Dark/light mode.** No theme toggle, no `dark:` Tailwind variants,
      no `prefers-color-scheme` handling, no `next-themes` (or equivalent)
      anywhere in `apps/web` - the design system (`packages/ui`) is
      light-only. Would need a theme provider, persisted user preference,
      and a pass over `packages/ui` + every page for dark-mode-safe colors.
