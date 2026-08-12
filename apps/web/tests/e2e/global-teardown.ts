/**
 * Mirrors global-setup's reset call at the END of the run, so the DB is left
 * in the seeded-only state regardless of how the suite exited. Belt-and-
 * suspenders: global-setup's reset already guarantees a clean start for the
 * NEXT run even if this teardown is skipped (e.g. process killed), but
 * running it here too keeps a long-lived local/CI Postgres instance tidy
 * for manual inspection between runs.
 */
async function globalTeardown(): Promise<void> {
  try {
    // The auth-consolidation epic moved every /api/test/* route (and the
    // mail sender it reads from) onto apps/api - apps/web has no rewrite
    // proxying this prefix back to it, so this must hit apps/api directly.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const response = await fetch(`${apiUrl}/api/test/reset`, {
      method: "POST",
      headers: { "x-e2e-secret": process.env.E2E_TEST_SECRET ?? "" },
    });
    if (!response.ok) {
      console.warn(`[global-teardown] Reset failed: HTTP ${String(response.status)}`);
    }
  } catch (error) {
    // Non-fatal: don't fail the whole run over teardown hygiene.
    console.warn("[global-teardown] Reset request failed:", error);
  }
}

export default globalTeardown;
