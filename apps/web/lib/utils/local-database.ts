/**
 * Hostnames that identify a LOCAL Postgres instance (see docker-compose.yml
 * and .env.example's default DATABASE_URL).
 *
 * CAVEAT: "postgres" is docker-compose.yml's own service name, which only
 * resolves as a hostname to something running inside that same compose
 * network - i.e. this assumes the app itself is never deployed as a
 * container on that same network in a real environment (e.g. a
 * self-hosted docker-compose deployment reusing this file's service names
 * for a live/production stack). No such deployment target exists for this
 * project today (Railway/Vercel-style deploys always connect to an
 * externally-addressed database, never a bare compose service name); if
 * that ever changes, this allowlist needs revisiting.
 */
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "postgres"]);

/**
 * True only when DATABASE_URL points at a local Postgres instance. A real
 * deployment (Railway, etc.) always connects to a remote-hosted database.
 * Fails closed on a malformed or missing DATABASE_URL.
 */
export function isLocalDatabase(): boolean {
  try {
    return LOCAL_DATABASE_HOSTS.has(new URL(process.env.DATABASE_URL ?? "").hostname);
  } catch {
    return false;
  }
}

/**
 * True only when BOTH ENABLE_TEST_ROUTES=true AND the app is connected to a
 * local database - the single definition of "this is an E2E run" shared by
 * every place that needs it: the test-route guard (`test-route-guard.ts`),
 * the email-sender factory's in-memory fallback (`lib/mail/sender.ts`), and
 * the production env-validation exemption (`env.ts`). Defined ONCE here
 * rather than each call site independently combining `process.env
 * .ENABLE_TEST_ROUTES === "true"` with `isLocalDatabase()` - that pattern
 * already drifted once (env.ts's exemption briefly checked only the flag,
 * not the database, while sender.ts checked both) before being consolidated
 * into this single function, the same treatment already applied to
 * `isResendSandboxAddress()` in packages/shared for an analogous reason: a
 * leaked ENABLE_TEST_ROUTES flag alone (copy-pasted env block, a flag left
 * on after debugging) can't silently widen any of these three behaviors in
 * a real deployment, since none of them will treat a remote-database
 * connection as a test run no matter what that one flag says.
 */
export function isE2ERun(): boolean {
  return process.env.ENABLE_TEST_ROUTES === "true" && isLocalDatabase();
}
