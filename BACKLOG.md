# Backlog

Non-blocking items found during the auth refactor review. Nothing here is a
security hole or a broken flow, just stuff that should get done eventually.

- [ ] Send a "your password was changed" email on successful reset
      (`apps/web/app/api/auth/reset-password/route.ts` sends nothing today).
- [ ] Add a GitHub Actions pipeline (lint, typecheck, test, build). Right now
      everything only runs locally.
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
